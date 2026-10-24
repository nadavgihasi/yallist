/// <reference path="./.sst/platform/config.d.ts" />

/**
 * AWS infrastructure (SST, eu-central-1). Deploy with an SSO profile:
 *   AWS_PROFILE=yallist-dev pnpm sst deploy --stage dev
 */
export default $config({
  app(input) {
    return {
      name: 'yallist',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      protect: input?.stage === 'production',
      home: 'aws',
      providers: { aws: { region: 'eu-central-1' } },
    };
  },
  async run() {
    // Single-page Expo web export on S3 + CloudFront. Unknown paths fall back to index.html
    // so deep links like /trips/:id load the app.
    const web = new sst.aws.StaticSite('Web', {
      path: 'apps/mobile',
      build: { command: 'pnpm export:web', output: 'dist' },
    });
    return { url: web.url };
  },
});
