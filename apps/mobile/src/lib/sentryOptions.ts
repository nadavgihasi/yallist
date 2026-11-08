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
  // Every error and every trace; traces carry the `sentry-trace` header to the API, which
  // continues them (apps/api/src/sentry.ts).
  sampleRate: 1,
  tracesSampleRate: 1,
  tracePropagationTargets: process.env.EXPO_PUBLIC_API_URL ? [process.env.EXPO_PUBLIC_API_URL] : [],
  sendDefaultPii: false,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
  beforeBreadcrumb: scrubEvent,
};

/**
 * What `reportError` sends with an error a boundary caught: React's component stack, which the
 * patched Expo Router boundary puts on the error (patches/expo-router@*.patch). It names the
 * component that crashed when the stack trace is all React internals. Like Sentry's React SDK,
 * it also goes in as the error's `cause` with the component stack as its stack, so source maps
 * turn it into file names and lines (the context copy stays minified).
 */
export function errorContext(error: unknown) {
  if (!error || typeof error !== 'object' || !('componentStack' in error)) return undefined;
  const componentStack = String(error.componentStack);
  if (error instanceof Error && error.cause === undefined) {
    const boundary = new Error(error.message);
    boundary.name = `React ErrorBoundary ${error.name}`;
    boundary.stack = `${boundary.name}: ${error.message}${componentStack}`;
    try {
      error.cause = boundary;
    } catch {
      // A frozen error keeps only the context.
    }
  }
  return { contexts: { react: { componentStack } } };
}
