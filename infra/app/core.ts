/**
 * The app's parts, the same in every stage that runs it: dev and production (stacks/app.ts) and
 * each PR preview (stacks/preview-pr.ts). Only the HTTP API differs: a stage of its own, or a
 * route on the preview stage's.
 */

// OAuth client IDs are public; one Google Cloud OAuth client per stage. Previews have none.
const GOOGLE_CLIENT_IDS: Record<string, string> = {
  dev: '320057100250-1lskqsmic04ek446i2rqlcdb82q315hd.apps.googleusercontent.com',
  production: '320057100250-skj1935jdjo5ttlf6khunvrcvktqj0il.apps.googleusercontent.com',
};

/** The API Lambda's timeout; API Gateway gives up at 30 seconds anyway. */
export const API_TIMEOUT_SECONDS = 20;

// HTTP API CORS. API Gateway owns CORS: with a CORS configuration it drops the integration's
// Access-Control-* headers and sets its own on every response. `cors: false` doesn't remove the
// configuration (SST sends an empty one, so no headers at all); configure it instead. Preflights
// still reach the app, so it answers them with a 2xx (apps/api/src/app.ts).
// Any origin: auth is bearer tokens, not cookies.
export const API_CORS: sst.aws.ApiGatewayV2Args['cors'] = {
  allowOrigins: ['*'],
  allowMethods: ['*'],
  allowHeaders: ['content-type', 'authorization'],
  maxAge: '1 day',
};

/**
 * CloudFront's managed SecurityHeadersPolicy: HSTS, nosniff, X-Frame-Options SAMEORIGIN (the
 * page, which holds the session, can't be framed by other sites) and Referrer-Policy
 * strict-origin-when-cross-origin (invite links' tokens stay on our origin).
 */
export function securityHeaders(args: sst.aws.CdnArgs) {
  args.defaultCacheBehavior = $output(args.defaultCacheBehavior).apply((behavior) => ({
    ...behavior,
    responseHeadersPolicyId: '67f7725c-6f97-4210-82d7-5512b31e9d03',
  }));
}

interface AppCoreArgs {
  /** Linked as `Api`: the stage's HTTP API, or a PR's Linkable with its URL. */
  api: sst.aws.ApiGatewayV2 | sst.Linkable<{ url: $util.Output<string> }>;
  apiUrl: $util.Output<string>;
  /** A PR preview: guests only, and its site on the preview Router under its prefix. */
  preview?: { router: sst.aws.Router; prefix: string };
}

/**
 * The database, secrets, realtime API, web site and receipts bucket, and the API Lambda's args,
 * which the caller attaches to its HTTP API.
 */
export function appCore({ api, apiUrl, preview }: AppCoreArgs) {
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

  // Better Auth (apps/api/src/auth.ts). Secret values come from SST_SECRET_<name>, which the
  // deploy workflow sets from GitHub environment secrets (docs/deploy.md#secrets).
  const authSecret = new sst.Secret('BetterAuthSecret');
  // Previews have no Google client: guests only.
  const googleClientSecret = new sst.Secret('GoogleClientSecret', preview ? 'unset' : undefined);
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
  const realtimeHttp = realtimeApi.dns.apply((dns) => dns.HTTP!);
  const realtime = new sst.Linkable('Realtime', {
    properties: { http: realtimeHttp },
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
    ...(preview && {
      router: { instance: preview.router, path: preview.prefix },
      // Only this PR's paths; the default, /*, would flush every other PR's site too.
      invalidation: { paths: [`${preview.prefix}/*`] },
    }),
    environment: {
      EXPO_PUBLIC_API_URL: apiUrl,
      EXPO_PUBLIC_REALTIME_URL: realtimeApi.dns.apply((dns) => dns.REALTIME!),
      // Google sign-in on web (Google Identity Services) uses the same OAuth client as the API.
      ...(GOOGLE_CLIENT_IDS[$app.stage] && {
        EXPO_PUBLIC_GOOGLE_CLIENT_ID: GOOGLE_CLIENT_IDS[$app.stage],
      }),
      ...(preview && { BASE_PATH: preview.prefix }),
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

  // Hono app (apps/api); one Lambda serves every path. Created by the caller, after the web app,
  // whose URL Better Auth trusts.
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

  return {
    web,
    apiFunction,
    realtimeAuthorizer,
    realtimeHttp,
    telegram: [telegramBotToken, telegramChatId],
  };
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
