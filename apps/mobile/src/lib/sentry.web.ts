import type * as SentryBrowser from '@sentry/browser';
import type { ComponentType } from 'react';

import { dsn, errorContext, options } from './sentryOptions';

/**
 * Sentry's prebuilt browser bundle (errors, tracing and replay, about 80 KB gzipped), pinned by version and
 * hash. Bundled through Metro, which doesn't tree-shake, the SDK would add over 250 KB. Keep the
 * version in step with @sentry/browser (types); the hash is the file's SHA-384:
 *   curl -s <src> | openssl dgst -sha384 -binary | openssl base64 -A
 */
const SDK = {
  src: 'https://browser.sentry-cdn.com/10.75.2/bundle.tracing.replay.min.js',
  integrity: 'sha384-cGj4AIJNwI7+3b+w67V+qupf0aOOFBy30etCzVsFi26JaPDPVZ1xJ4U+zenfFbT+',
};

// Loaded after the app, only with a DSN; errors in the first moments are missed. Uncaught errors
// reach it through the window's error event; the ones an error boundary catches, `reportError`.
if (dsn) {
  const script = document.createElement('script');
  Object.assign(script, { src: SDK.src, integrity: SDK.integrity, crossOrigin: 'anonymous' });
  script.onload = () => {
    const { Sentry } = window as unknown as { Sentry: typeof SentryBrowser };
    Sentry.init({
      ...options,
      // Replays only of sessions that hit an error: the minute before it, with every text and
      // image masked (the replay defaults), so names and photos stay out of Sentry.
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1,
      integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    });
  };
  document.head.append(script);
}

export const withSentry = <P extends object>(root: ComponentType<P>) => root;

/** Reports an error a boundary caught; a no-op until the SDK has loaded (never without a DSN). */
export const reportError = (error: unknown) =>
  void (window as { Sentry?: typeof SentryBrowser }).Sentry?.captureException(
    error,
    errorContext(error),
  );
