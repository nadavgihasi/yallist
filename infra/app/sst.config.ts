/// <reference path="./.sst/platform/config.d.ts" />

/**
 * AWS infrastructure (SST). dev in us-east-2 and production in eu-central-1, plus PR previews in
 * us-west-2 (docs/plans/e2e-live-environments.md):
 *   pnpm deploy:dev    # sst deploy --stage dev         (AWS profile yallist-dev)
 *   pnpm deploy:prod   # sst deploy --stage production  (AWS profile yallist-prod)
 *   preview            # the CloudFront Router and HTTP API every PR shares (preview-stage.yml)
 *   pr-<n>             # one PR's API, database, realtime, receipts and site (preview.yml)
 * SST names resources `yallist-<stage>-<name>-<hash>`; every resource is also tagged app/stage.
 */
const STAGES = ['dev', 'production'];
const PR_STAGE = /^pr-\d+$/;
const PREVIEW_REGION = 'us-west-2';
// Written by the preview stage, read by every pr-<n> stage: the shared API and Router.
const PREVIEW_OUTPUTS = '/yallist/preview/outputs';
// A PR's stage is removed this long after its last deploy (preview.yml, expire).
const PREVIEW_TTL_HOURS = 6;

/** The API Lambda's timeout; API Gateway gives up at 30 seconds anyway. */
const API_TIMEOUT_SECONDS = 20;

const GOOGLE_CLIENT_IDS: Record<string, string> = {
  dev: '320057100250-1lskqsmic04ek446i2rqlcdb82q315hd.apps.googleusercontent.com',
  production: '320057100250-skj1935jdjo5ttlf6khunvrcvktqj0il.apps.googleusercontent.com',
};

// HTTP API CORS. API Gateway owns CORS: with a CORS configuration it drops the integration's
// Access-Control-* headers and sets its own on every response. `cors: false` doesn't remove the
// configuration (SST sends an empty one, so no headers at all); configure it instead. Preflights
// still reach the app, so it answers them with a 2xx (apps/api/src/app.ts).
// Any origin: auth is bearer tokens, not cookies.
const API_CORS: sst.aws.ApiGatewayV2Args['cors'] = {
  allowOrigins: ['*'],
  allowMethods: ['*'],
  allowHeaders: ['content-type', 'authorization'],
  maxAge: '1 day',
};

interface PreviewOutputs {
  apiId: string;
  apiUrl: string;
  apiExecutionArn: string;
  distributionId: string;
}

export default $config({
  app(input) {
    const stage = input?.stage;
    const preview = stage === 'preview' || PR_STAGE.test(stage);
    if (!preview && !STAGES.includes(stage)) {
      throw new Error(`Unknown stage "${stage}". Pass --stage dev, production, preview or pr-<n>.`);
    }
    // PR stages deploy with the preview role (infra/global), which only CI can assume.
    if (PR_STAGE.test(stage) && !process.env.CI) {
      throw new Error(`Stage "${stage}" is deployed by CI only (.github/workflows/preview.yml).`);
    }
    const production = stage === 'production';
    return {
      name: 'yallist',
      removal: production ? 'retain' : 'remove',
      protect: production,
      home: 'aws',
      providers: {
        aws: {
          // Each stage in its own region; previews all in one.
          region: preview ? PREVIEW_REGION : production ? 'eu-central-1' : 'us-east-2',
          // Per stage, so every sst command (deploy, remove, diff) uses the right credentials.
          // CI gets credentials from the GitHub OIDC role instead.
          profile: process.env.CI ? undefined : production ? 'yallist-prod' : 'yallist-dev',
          defaultTags: { tags: { app: 'yallist', stage } },
        },
      },
    };
  },
  async run() {
    if ($app.stage === 'preview') return previewShared();

    // Every Lambda (the API route and the realtime authorizer) on Graviton: ~20% cheaper than
    // x86_64. The bundles are plain JS; nothing in apps/api ships a native binary.
    $transform(sst.aws.Function, (args) => {
      args.architecture ??= 'arm64';
    });

    // A PR preview's stage: the shared HTTP API and Router of the preview stage, under /pr-<n>.
    const pr = PR_STAGE.test($app.stage);
    const shared = pr
      ? aws.ssm
          .getParameterOutput({ name: PREVIEW_OUTPUTS })
          .value.apply((value) => JSON.parse(value) as PreviewOutputs)
      : undefined;
    const prefix = `/${$app.stage}`;
    if (pr) {
      // Every role a PR stage creates (its Lambdas') is capped by the boundary (infra/global).
      const boundary = $interpolate`arn:aws:iam::${aws.getCallerIdentityOutput().accountId}:policy/yallist-preview-workload-boundary`;
      $transform(aws.iam.Role, (args) => {
        args.permissionsBoundary = boundary;
      });
    }

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

    // Hono app (apps/api) behind an HTTP API; one Lambda serves every path. A PR adds a route
    // for its prefix to the preview stage's API instead, and the app serves itself under it.
    // The route is added after the web app, whose URL Better Auth trusts.
    const httpApi = shared ? undefined : new sst.aws.ApiGatewayV2('Api', { cors: API_CORS });
    const apiUrl = shared ? $interpolate`${shared.apiUrl}${prefix}` : httpApi!.url;
    const api = httpApi ?? new sst.Linkable('Api', { properties: { url: apiUrl } });

    // Better Auth (apps/api/src/auth.ts). Secret values come from SST_SECRET_<name>, which the
    // deploy workflow sets from GitHub environment secrets (docs/deploy.md#secrets).
    const authSecret = new sst.Secret('BetterAuthSecret');
    // Previews have no Google client: guests only.
    const googleClientSecret = new sst.Secret('GoogleClientSecret', pr ? 'unset' : undefined);
    // Opens a GitHub issue per feature request from the app (apps/api/src/routes/feedback.ts).
    // Optional: until the GitHub secret exists, the placeholder makes the API only save requests.
    const githubFeedbackToken = new sst.Secret('GithubFeedbackToken', 'unset');
    // Telegram bot that alerts and Sentry issues post to (apps/api/src/notify/telegram.ts).
    // Optional: with either value empty or the `unset` placeholder, nothing is sent and the
    // notifier logs a warning. Previews never set them.
    const telegramBotToken = new sst.Secret('TelegramBotToken', 'unset');
    const telegramChatId = new sst.Secret('TelegramChatId', 'unset');
    // Sentry (docs/deploy.md, Monitoring): the API project's DSN, and the internal integration's
    // client secret that signs its webhook. Optional: unset, the API reports nothing and the
    // webhook answers 404. Previews never set them.
    const sentryDsn = new sst.Secret('SentryDsn', 'unset');
    const sentryWebhookSecret = new sst.Secret('SentryWebhookSecret', 'unset');
    // OAuth client IDs are public; one Google Cloud OAuth client per stage.
    const authEnvironment = { GOOGLE_CLIENT_ID: GOOGLE_CLIENT_IDS[$app.stage] ?? 'unset' };

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
    // so deep links like /trips/:id load the app. A PR's site is served by the preview stage's
    // Router under its prefix, which the export takes as its base URL (apps/mobile/app.config.ts).
    const web = new sst.aws.StaticSite('Web', {
      path: '../../apps/mobile',
      // With SENTRY_AUTH_TOKEN (deploy.yml), uploads the source maps to Sentry; never deploys them.
      build: { command: 'pnpm export:web:release', output: 'dist' },
      ...(shared && {
        router: { instance: sst.aws.Router.get('Router', shared.distributionId), path: prefix },
        // Only this PR's paths; the default, /*, would flush every other PR's site too.
        invalidation: { paths: [`${prefix}/*`] },
      }),
      environment: {
        EXPO_PUBLIC_API_URL: apiUrl,
        EXPO_PUBLIC_REALTIME_URL: realtimeApi.dns.apply((dns) => dns.REALTIME!),
        // Google sign-in on web (Google Identity Services) uses the same OAuth client as the API.
        ...(GOOGLE_CLIENT_IDS[$app.stage] && {
          EXPO_PUBLIC_GOOGLE_CLIENT_ID: GOOGLE_CLIENT_IDS[$app.stage],
        }),
        ...(pr && { BASE_PATH: prefix }),
        // Keys the app's persisted query cache, so a deploy discards caches from older builds.
        ...(process.env.GITHUB_SHA && { EXPO_PUBLIC_GIT_SHA: process.env.GITHUB_SHA }),
      },
      transform: {
        // A distribution has no name, only a comment (default "Web site"); put the stage in it.
        cdn: (args) => {
          args.comment = `yallist-${$app.stage}-web`;
          securityHeaders(args);
        },
      },
    });
    // The site's origin; a PR's site URL has its prefix.
    const webOrigin = web.url.apply((url) => new URL(url).origin);

    // Receipt and profile photos (apps/api/src/receipts.ts, avatars.ts), one private bucket per
    // stage (SST blocks public access by default), keyed trips/<tripId>/receipts/<expenseId>/
    // <uuid>.<ext> and avatars/<userId>/<uuid>.<ext>. The app uploads with a presigned POST and
    // views through short-lived presigned GETs (the API hands avatar links only to trip-mates),
    // so browsers need CORS for the upload from the web app and the local Expo web server.
    const receipts = new sst.aws.Bucket('Receipts', {
      cors: {
        allowOrigins: [webOrigin, 'http://localhost:8081'],
        allowMethods: ['GET', 'POST'],
        allowHeaders: ['*'],
        maxAge: '1 day',
      },
    });

    const apiFunction = {
      handler: '../../apps/api/src/lambda.handler',
      runtime: 'nodejs24.x',
      timeout: `${API_TIMEOUT_SECONDS} seconds`,
      hook: { postbuild: uploadSourceMaps('yallist-api') },
      link: [
        database,
        api,
        web,
        authSecret,
        googleClientSecret,
        githubFeedbackToken,
        realtime,
        receipts,
        sentryDsn,
        sentryWebhookSecret,
        telegramBotToken,
        telegramChatId,
      ],
      environment: {
        ...authEnvironment,
        ...(process.env.APP_VERSION && { SENTRY_RELEASE: `yallist@${process.env.APP_VERSION}` }),
      },
    } satisfies sst.aws.FunctionArgs;

    if (httpApi) {
      const route = httpApi.route('$default', apiFunction);
      alerts(httpApi.nodes.api.id, route.nodes.function.name, realtimeAuthorizer.name, [
        telegramBotToken,
        telegramChatId,
      ]);
      return { url: web.url, api: apiUrl };
    }

    // The PR's route on the shared HTTP API: `ANY /pr-<n>/{proxy+}` to its own Lambda.
    const fn = new sst.aws.Function('ApiFunction', {
      ...apiFunction,
      // When the preview workflow removes this stage (preview.yml, expire).
      tags: {
        'expires-at': new Date(Date.now() + PREVIEW_TTL_HOURS * 3600_000).toISOString(),
      },
    });
    const integration = new aws.apigatewayv2.Integration('ApiIntegration', {
      apiId: shared!.apiId,
      integrationType: 'AWS_PROXY',
      integrationUri: fn.arn,
      payloadFormatVersion: '2.0',
    });
    new aws.apigatewayv2.Route('ApiRoute', {
      apiId: shared!.apiId,
      routeKey: `ANY ${prefix}/{proxy+}`,
      target: $interpolate`integrations/${integration.id}`,
    });
    new aws.lambda.Permission('ApiInvoke', {
      action: 'lambda:InvokeFunction',
      function: fn.name,
      principal: 'apigateway.amazonaws.com',
      sourceArn: $interpolate`${shared!.apiExecutionArn}/*`,
    });
    return { url: web.url, api: apiUrl };
  },
});

/**
 * CloudFront's managed SecurityHeadersPolicy: HSTS, nosniff, X-Frame-Options SAMEORIGIN (the
 * page, which holds the session, can't be framed by other sites) and Referrer-Policy
 * strict-origin-when-cross-origin (invite links' tokens stay on our origin).
 */
function securityHeaders(args: sst.aws.CdnArgs) {
  args.defaultCacheBehavior = $output(args.defaultCacheBehavior).apply((behavior) => ({
    ...behavior,
    responseHeadersPolicyId: '67f7725c-6f97-4210-82d7-5512b31e9d03',
  }));
}

/**
 * The preview stage: what every PR stage shares, because it's slow to create (CloudFront) or
 * has room for hundreds of PRs (an HTTP API's routes). Nothing answers outside a PR's prefix.
 * Its ids go to an SSM parameter, which PR stages read.
 */
function previewShared() {
  const router = new sst.aws.Router('Router', {
    transform: {
      cdn: (args) => {
        args.comment = 'yallist-preview-router';
        securityHeaders(args);
      },
    },
  });
  const api = new sst.aws.ApiGatewayV2('Api', { cors: API_CORS });
  new aws.ssm.Parameter('Outputs', {
    name: PREVIEW_OUTPUTS,
    type: 'String',
    value: $jsonStringify({
      apiId: api.nodes.api.id,
      apiUrl: api.url,
      apiExecutionArn: api.nodes.api.executionArn,
      distributionId: router.nodes.cdn.apply((cdn) => cdn!.nodes.distribution.id),
    }),
  });
  return { router: router.url, api: api.url };
}

/**
 * Alerts: CloudWatch alarms publish to an SNS topic on ALARM and OK (CloudWatch only notifies on a
 * state change, never repeats), and the notifier posts each to Telegram
 * (apps/api/src/alarm-notifier.ts). Production only; dev has the topic, no alarms; PRs neither.
 */
function alerts(
  apiId: $util.Input<string>,
  apiFunction: $util.Input<string>,
  realtimeAuthorizer: $util.Input<string>,
  telegram: sst.Secret[],
) {
  const topic = new sst.aws.SnsTopic('Alerts');
  topic.subscribe('AlertsNotifier', {
    handler: '../../apps/api/src/alarm-notifier.handler',
    runtime: 'nodejs24.x',
    link: telegram,
  });
  if ($app.stage === 'production') {
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
      dimensions: { ApiId: apiId },
      threshold: 5,
    });
    alarm('RealtimeAuthorizerErrors', 'Realtime authorizer failed: clients cannot subscribe', {
      ...lambda(realtimeAuthorizer, 'Errors'),
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
      alarmActions: [topic.arn],
      okActions: [topic.arn],
    });
  }
}

/**
 * A Function `postbuild` hook that, with SENTRY_AUTH_TOKEN (deploy.yml), gives the bundle a
 * debug ID and uploads its source map to the Sentry project. SST builds the source map but
 * leaves it out of the deployed zip.
 */
function uploadSourceMaps(project: string) {
  return async (dir: string) => {
    if (!process.env.SENTRY_AUTH_TOKEN) return;
    const { execFileSync } = await import('node:child_process');
    const cli = (...args: string[]) =>
      execFileSync('pnpm', ['exec', 'sentry-cli', ...args], { stdio: 'inherit' });
    cli('sourcemaps', 'inject', dir);
    cli('sourcemaps', 'upload', '--project', project, dir);
  };
}
