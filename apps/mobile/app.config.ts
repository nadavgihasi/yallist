import type { ConfigContext } from 'expo/config';

// app.json plus the version, which CI takes from the release tag (docs/releases.md).
export default ({ config }: ConfigContext) => ({
  ...config,
  version: process.env.APP_VERSION ?? '0.0.0-dev',
});
