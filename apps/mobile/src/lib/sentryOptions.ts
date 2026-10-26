import { scrubEvent } from '@yallist/domain';
import Constants from 'expo-constants';

/**
 * Set by CI at build time (deploy.yml, android.yml). Without it (local dev, tests, UI tests)
 * Sentry isn't loaded and nothing is sent.
 */
export const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** Sentry options shared by the web and Android SDKs (sentry.ts, sentry.web.ts). */
export const options = {
  dsn,
  // Must match the release and dist the source maps are uploaded with (android.yml).
  release: `yallist@${Constants.expoConfig?.version ?? '0.0.0-dev'}`,
  dist: process.env.EXPO_PUBLIC_GIT_SHA,
  environment: process.env.EXPO_PUBLIC_STAGE ?? 'local',
  // Every error, few traces.
  sampleRate: 1,
  tracesSampleRate: 0.05,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
  beforeBreadcrumb: scrubEvent,
};
