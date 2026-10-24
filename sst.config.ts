/// <reference path="./.sst/platform/config.d.ts" />

/**
 * AWS infrastructure (SST, eu-central-1). Two stages, nothing else:
 *   pnpm deploy:dev    # sst deploy --stage dev         (AWS profile yallist-dev)
 *   pnpm deploy:prod   # sst deploy --stage production  (AWS profile yallist-prod)
 * SST names resources `yallist-<stage>-<name>-<hash>`; every resource is also tagged app/stage.
 */
const STAGES = ['dev', 'production'];

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
          region: 'eu-central-1',
          // Per stage, so every sst command (deploy, remove, diff) uses the right credentials.
          profile: production ? 'yallist-prod' : 'yallist-dev',
          defaultTags: { tags: { app: 'yallist', stage } },
        },
      },
    };
  },
  async run() {
    // Single-page Expo web export on S3 + CloudFront. Unknown paths fall back to index.html
    // so deep links like /trips/:id load the app.
    const web = new sst.aws.StaticSite('Web', {
      path: 'apps/mobile',
      build: { command: 'pnpm export:web', output: 'dist' },
      transform: {
        // A distribution has no name, only a comment (default "Web site"); put the stage in it.
        cdn: (args) => {
          args.comment = `yallist-${$app.stage}-web`;
        },
      },
    });
    return { url: web.url };
  },
});
