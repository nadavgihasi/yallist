/// <reference path="./.sst/platform/config.d.ts" />

/**
 * AWS infrastructure (SST). One app, three kinds of stage, each defined in its own file
 * (docs/plans/e2e-live-environments.md):
 *   dev, production   stacks/app.ts             the app and its alerts; us-east-2 and eu-central-1
 *                       pnpm deploy:dev    # sst deploy --stage dev         (AWS profile yallist-dev)
 *                       pnpm deploy:prod   # sst deploy --stage production  (AWS profile yallist-prod)
 *   preview           stacks/preview-shared.ts  what every PR shares: the CloudFront Router and HTTP
 *                                               API, us-west-2 (preview-stage.yml)
 *   pr-<n>            stacks/preview-pr.ts      one PR's own copy of the app, on the shared Router
 *                                               and API, us-west-2 (preview.yml)
 * stacks/app.ts and stacks/preview-pr.ts build the app from the same parts (core.ts).
 * SST names resources `yallist-<stage>-<name>-<hash>`; every resource is also tagged app/stage.
 */
const STAGES = ['dev', 'production'];
const PR_STAGE = /^pr-\d+$/;
const PREVIEW_REGION = 'us-west-2';

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
    if ($app.stage === 'preview') return (await import('./stacks/preview-shared')).previewShared();
    if (PR_STAGE.test($app.stage)) return (await import('./stacks/preview-pr')).previewPr();
    return (await import('./stacks/app')).app();
  },
});
