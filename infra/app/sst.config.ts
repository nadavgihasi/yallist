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
        cluster: { tags: { Name: `yallist-${$app.stage}-database` } },
      },
    });

    // Hono app (apps/api) behind an HTTP API; one Lambda serves every path.
    // CORS stays at SST's default (any origin): auth is bearer tokens, not cookies, so allowing
    // every origin exposes nothing. It also avoids a cycle: the web build needs the API URL.
    // Its route is added after the web app, whose URL Better Auth trusts.
    const api = new sst.aws.ApiGatewayV2('Api');

    // Single-page Expo web export on S3 + CloudFront. Unknown paths fall back to index.html
    // so deep links like /trips/:id load the app.
    const web = new sst.aws.StaticSite('Web', {
      path: '../../apps/mobile',
      build: { command: 'pnpm export:web', output: 'dist' },
      environment: { EXPO_PUBLIC_API_URL: api.url },
      transform: {
        // A distribution has no name, only a comment (default "Web site"); put the stage in it.
        cdn: (args) => {
          args.comment = `yallist-${$app.stage}-web`;
        },
      },
    });

    // Better Auth (apps/api/src/auth.ts). Secret values come from SST_SECRET_<name>, which the
    // deploy workflow sets from GitHub environment secrets (docs/deploy.md#secrets).
    const authSecret = new sst.Secret('BetterAuthSecret');
    const googleClientSecret = new sst.Secret('GoogleClientSecret');
    api.route('$default', {
      handler: '../../apps/api/src/lambda.handler',
      link: [database, api, web, authSecret, googleClientSecret],
      // OAuth client IDs are public; one Google Cloud OAuth client per stage.
      environment: { GOOGLE_CLIENT_ID: GOOGLE_CLIENT_IDS[$app.stage] },
    });

    return { url: web.url, api: api.url };
  },
});
