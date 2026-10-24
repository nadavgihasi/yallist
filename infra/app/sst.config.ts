/// <reference path="./.sst/platform/config.d.ts" />

/**
 * AWS infrastructure (SST). Two stages, nothing else: dev in us-east-2, production in eu-central-1.
 *   pnpm deploy:dev    # sst deploy --stage dev         (AWS profile yallist-dev)
 *   pnpm deploy:prod   # sst deploy --stage production  (AWS profile yallist-prod)
 * SST names resources `yallist-<stage>-<name>-<hash>`; every resource is also tagged app/stage.
 */
const STAGES = ['dev', 'production'];

const GOOGLE_CLIENT_IDS: Record<string, string> = {
  dev: '320057100250-1lskqsmic04ek446i2rqlcdb82q315hd.apps.googleusercontent.com',
  production: '320057100250-skj1935jdjo5ttlf6khunvrcvktqj0il.apps.googleusercontent.com',
};

export default $config({
  app(input) {
    const stage = input?.stage;
    if (!STAGES.includes(stage)) {
      throw new Error(`Unknown stage "${stage}". Pass --stage dev or --stage production.`);
    }
    const production = stage === 'production';
    return {
      name: 'yallist',
      removal: production ? 'retain' : 'remove',
      protect: production,
      home: 'aws',
      providers: {
        aws: {
          // Each stage in its own region.
          region: production ? 'eu-central-1' : 'us-east-2',
          // Per stage, so every sst command (deploy, remove, diff) uses the right credentials.
          // CI gets credentials from the GitHub OIDC role instead.
          profile: process.env.CI ? undefined : production ? 'yallist-prod' : 'yallist-dev',
          defaultTags: { tags: { app: 'yallist', stage } },
        },
      },
    };
  },
  async run() {
    // Aurora DSQL, one cluster per stage. Linked functions connect with IAM auth tokens
    // (apps/api/src/db/client.ts). Migrations run after deploy (.github/workflows/deploy.yml).
    const database = new sst.aws.Dsql('Database', {
      transform: {
        // A cluster has no name, only an identifier; put the stage in its Name tag.
        cluster: {
          tags: { Name: `yallist-${$app.stage}-database` },
          // `protect` only stops SST; this also stops a delete from the console or CLI.
          deletionProtectionEnabled: $app.stage === 'production',
        },
      },
    });

    // Hono app (apps/api) behind an HTTP API; one Lambda serves every path.
    // API Gateway owns CORS: with a CORS configuration it drops the integration's Access-Control-*
    // headers and sets its own on every response. `cors: false` doesn't remove the configuration
    // (SST sends an empty one, so no headers at all); configure it instead. Preflights still reach
    // the `$default` route, so the app answers them with a 2xx (apps/api/src/app.ts).
    // Any origin: auth is bearer tokens, not cookies.
    // Its route is added after the web app, whose URL Better Auth trusts.
    const api = new sst.aws.ApiGatewayV2('Api', {
      cors: {
        allowOrigins: ['*'],
        allowMethods: ['*'],
        allowHeaders: ['content-type', 'authorization'],
        maxAge: '1 day',
      },
    });

    // Better Auth (apps/api/src/auth.ts). Secret values come from SST_SECRET_<name>, which the
    // deploy workflow sets from GitHub environment secrets (docs/deploy.md#secrets).
    const authSecret = new sst.Secret('BetterAuthSecret');
    const googleClientSecret = new sst.Secret('GoogleClientSecret');
    // Opens a GitHub issue per feature request from the app (apps/api/src/routes/feedback.ts).
    // Optional: until the GitHub secret exists, the placeholder makes the API only save requests.
    const githubFeedbackToken = new sst.Secret('GithubFeedbackToken', 'unset');
    // OAuth client IDs are public; one Google Cloud OAuth client per stage.
    const authEnvironment = { GOOGLE_CLIENT_ID: GOOGLE_CLIENT_IDS[$app.stage] };

    // Realtime (apps/api/src/realtime.ts): an AppSync Events API with a channel per trip,
    // /trips/<tripId>. Clients connect and subscribe with their session token, checked by the
    // authorizer; only the API publishes, signed with its IAM role.
    const realtimeAuthorizer = new sst.aws.Function('RealtimeAuthorizer', {
      handler: '../../apps/api/src/realtime-authorizer.handler',
      runtime: 'nodejs24.x',
      link: [database, api, authSecret, googleClientSecret],
      environment: authEnvironment,
    });
    const realtimeApi = new aws.appsync.Api('RealtimeApi', {
      name: `${$app.name}-${$app.stage}-realtime`,
      eventConfig: {
        authProviders: [
          {
            authType: 'AWS_LAMBDA',
            // No caching: a cached decision would be reused for other channels.
            lambdaAuthorizerConfig: {
              authorizerUri: realtimeAuthorizer.arn,
              authorizerResultTtlInSeconds: 0,
            },
          },
          { authType: 'AWS_IAM' },
        ],
        connectionAuthModes: [{ authType: 'AWS_LAMBDA' }],
        defaultSubscribeAuthModes: [{ authType: 'AWS_LAMBDA' }],
        defaultPublishAuthModes: [{ authType: 'AWS_IAM' }],
      },
    });
    new aws.lambda.Permission('RealtimeAuthorizerInvoke', {
      action: 'lambda:InvokeFunction',
      function: realtimeAuthorizer.name,
      principal: 'appsync.amazonaws.com',
      sourceArn: realtimeApi.apiArn,
    });
    new aws.appsync.ChannelNamespace('RealtimeTrips', { apiId: realtimeApi.apiId, name: 'trips' });
    const realtime = new sst.Linkable('Realtime', {
      properties: { http: realtimeApi.dns.apply((dns) => dns.HTTP!) },
      include: [
        sst.aws.permission({
          actions: ['appsync:EventPublish'],
          resources: [$interpolate`${realtimeApi.apiArn}/*`],
        }),
      ],
    });

    // Single-page Expo web export on S3 + CloudFront. Unknown paths fall back to index.html
    // so deep links like /trips/:id load the app.
    const web = new sst.aws.StaticSite('Web', {
      path: '../../apps/mobile',
      build: { command: 'pnpm export:web', output: 'dist' },
      environment: {
        EXPO_PUBLIC_API_URL: api.url,
        EXPO_PUBLIC_REALTIME_URL: realtimeApi.dns.apply((dns) => dns.REALTIME!),
        // Google sign-in on web (Google Identity Services) uses the same OAuth client as the API.
        EXPO_PUBLIC_GOOGLE_CLIENT_ID: GOOGLE_CLIENT_IDS[$app.stage],
        // Keys the app's persisted query cache, so a deploy discards caches from older builds.
        ...(process.env.GITHUB_SHA && { EXPO_PUBLIC_GIT_SHA: process.env.GITHUB_SHA }),
      },
      transform: {
        // A distribution has no name, only a comment (default "Web site"); put the stage in it.
        cdn: (args) => {
          args.comment = `yallist-${$app.stage}-web`;
          // CloudFront's managed SecurityHeadersPolicy: HSTS, nosniff, X-Frame-Options SAMEORIGIN
          // (the page, which holds the session, can't be framed by other sites) and
          // Referrer-Policy strict-origin-when-cross-origin (invite links' tokens stay on our origin).
          args.defaultCacheBehavior = $output(args.defaultCacheBehavior).apply((behavior) => ({
            ...behavior,
            responseHeadersPolicyId: '67f7725c-6f97-4210-82d7-5512b31e9d03',
          }));
        },
      },
    });

    // Receipt photos (apps/api/src/receipts.ts), one private bucket per stage (SST blocks public
    // access by default), keyed trips/<tripId>/receipts/<expenseId>/<uuid>.<ext>. The app uploads
    // with a presigned POST and views through short-lived presigned GETs, so browsers need CORS
    // for the upload from the web app and the local Expo web server.
    const receipts = new sst.aws.Bucket('Receipts', {
      cors: {
        allowOrigins: [web.url, 'http://localhost:8081'],
        allowMethods: ['GET', 'POST'],
        allowHeaders: ['*'],
        maxAge: '1 day',
      },
    });

    api.route('$default', {
      handler: '../../apps/api/src/lambda.handler',
      runtime: 'nodejs24.x',
      link: [
        database,
        api,
        web,
        authSecret,
        googleClientSecret,
        githubFeedbackToken,
        realtime,
        receipts,
      ],
      environment: authEnvironment,
    });

    return { url: web.url, api: api.url };
  },
});
