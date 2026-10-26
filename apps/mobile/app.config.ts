import type { ConfigContext } from 'expo/config';

// app.json plus the version, which CI takes from the release tag (docs/releases.md), and for a PR
// preview's web export the path it's served under, BASE_PATH=/pr-123 (infra/app/sst.config.ts).
export default ({ config }: ConfigContext) => ({
  ...config,
  version: process.env.APP_VERSION ?? '0.0.0-dev',
  ...(process.env.BASE_PATH && {
    experiments: { ...config.experiments, baseUrl: process.env.BASE_PATH },
  }),
});
