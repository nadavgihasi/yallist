/// <reference path="./.sst/platform/config.d.ts" />

/**
 * AWS infrastructure (SST). Two stages, nothing else: dev in us-east-2, production in eu-central-1.
 *   pnpm deploy:dev    # sst deploy --stage dev         (AWS profile yallist-dev)
 *   pnpm deploy:prod   # sst deploy --stage production  (AWS profile yallist-prod)
 * SST names resources `yallist-<stage>-<name>-<hash>`; every resource is also tagged app/stage.
 */
const STAGES = ['dev', 'production'];

/** The API Lambda's timeout; API Gateway gives up at 30 seconds anyway. */
const API_TIMEOUT_SECONDS = 20;

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
    // Every Lambda (the API route and the realtime authorizer) on Graviton: ~20% cheaper than
    // x86_64. The bundles are plain JS; nothing in apps/api ships a native binary.
    $transform(sst.aws.Function, (args) => {
      args.architecture ??= 'arm64';
    });

    // Aurora DSQL, one cluster per stage. Linked functions connect with IAM auth tokens
    // (apps/api/src/db/client.ts). Migrations run after deploy (.github/workflows/deploy.yml).
    const database = new sst.aws.Dsql('Database', {
      // AWS Backup: a vault, plan and selection beside the cluster (daily at 05:00 UTC, kept 7 days).
      backup: $app.stage === 'production',
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
    // Telegram bot that alerts post to (apps/api/src/notify/telegram.ts). Optional: with either
    // value empty or the `unset` placeholder, nothing is sent and the notifier logs a warning.
    const telegramBotToken = new sst.Secret('TelegramBotToken', 'unset');
    const telegramChatId = new sst.Secret('TelegramChatId', 'unset');
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

    const apiRoute = api.route('$default', {
      handler: '../../apps/api/src/lambda.handler',
      runtime: 'nodejs24.x',
      timeout: `${API_TIMEOUT_SECONDS} seconds`,
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

    // Alerts: CloudWatch alarms publish to this topic on ALARM and OK (CloudWatch only notifies
    // on a state change, never repeats), and the notifier posts each to Telegram
    // (apps/api/src/alarm-notifier.ts). Production only; dev has the topic, no alarms.
    const alerts = new sst.aws.SnsTopic('Alerts');
    alerts.subscribe('AlertsNotifier', {
      handler: '../../apps/api/src/alarm-notifier.handler',
      runtime: 'nodejs24.x',
      link: [telegramBotToken, telegramChatId],
    });
    if ($app.stage === 'production') {
      const apiFunction = apiRoute.nodes.function.name;
      const lambda = (fn: $util.Input<string>, metricName: string) => ({
        namespace: 'AWS/Lambda',
        metricName,
        dimensions: { FunctionName: fn },
      });
      alarm('ApiErrors', 'API Lambda invocations failed (crash, timeout or out of memory)', {
        ...lambda(apiFunction, 'Errors'),
        threshold: 3,
      });
      alarm('ApiThrottles', 'API Lambda invocations throttled (concurrency limit)', {
        ...lambda(apiFunction, 'Throttles'),
        threshold: 1,
      });
      alarm('ApiDuration', `API Lambda took over 80% of its ${API_TIMEOUT_SECONDS}s timeout`, {
        ...lambda(apiFunction, 'Duration'),
        statistic: 'Maximum',
        threshold: API_TIMEOUT_SECONDS * 1000 * 0.8,
      });
      alarm('Api5xx', 'API Gateway answered 5xx (unhandled errors in the API)', {
        namespace: 'AWS/ApiGateway',
        metricName: '5xx',
        dimensions: { ApiId: api.nodes.api.id },
        threshold: 5,
      });
      alarm('RealtimeAuthorizerErrors', 'Realtime authorizer failed: clients cannot subscribe', {
        ...lambda(realtimeAuthorizer.name, 'Errors'),
        threshold: 3,
      });
    }

    /**
     * A 5-minute alarm on `metric` reaching `threshold` (summed unless `statistic` says otherwise)
     * that notifies the Alerts topic on ALARM and on OK. No data (no traffic) counts as healthy.
     */
    function alarm(
      name: string,
      description: string,
      metric: Pick<
        aws.cloudwatch.MetricAlarmArgs,
        'namespace' | 'metricName' | 'dimensions' | 'threshold' | 'statistic'
      >,
    ) {
      new aws.cloudwatch.MetricAlarm(`Alarm${name}`, {
        name: `${$app.name}-${$app.stage}-${name}`,
        alarmDescription: description,
        statistic: 'Sum',
        ...metric,
        period: 300,
        evaluationPeriods: 1,
        comparisonOperator: 'GreaterThanOrEqualToThreshold',
        treatMissingData: 'notBreaching',
        alarmActions: [alerts.arn],
        okActions: [alerts.arn],
      });
    }

    return { url: web.url, api: api.url };
  },
});
