import * as Sentry from '@sentry/node-core/light';
import { scrubEvent } from '@yallist/domain';
import type { MiddlewareHandler } from 'hono';
import { routePath } from 'hono/route';

/**
 * Starts Sentry in this Lambda: every error and every request's trace (`tracing` below). The
 * light SDK (no OpenTelemetry) keeps the bundle and cold start small. Without a DSN (unset or
 * SST's `unset` placeholder: local, tests) nothing is started and reportError only logs.
 */
export function initSentry(dsn: string | undefined, environment: string) {
  if (!dsn || dsn === 'unset') return;
  Sentry.init({
    dsn,
    environment,
    // Set by infra/app/core.ts from the release tag.
    release: process.env.SENTRY_RELEASE,
    sampleRate: 1,
    tracesSampleRate: 1,
    sendDefaultPii: false,
    // Local variables could hold personal data; sessions don't fit a Lambda.
    integrations: (defaults) =>
      defaults.filter((i) => !['LocalVariables', 'ProcessSession'].includes(i.name)),
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
    beforeBreadcrumb: scrubEvent,
  });
}

/**
 * One span per request, named by its route pattern (no ids), continuing the app's trace from its
 * `sentry-trace` and `baggage` headers, so a slow screen shows the API time inside it. Waits for
 * the span to be sent: a Lambda is frozen once it answers. A no-op without `initSentry`.
 */
export function tracing(): MiddlewareHandler {
  return async (c, next) => {
    if (!Sentry.isInitialized()) return next();
    await Sentry.withIsolationScope(() =>
      Sentry.continueTrace(
        { sentryTrace: c.req.header('sentry-trace'), baggage: c.req.header('baggage') },
        () =>
          Sentry.startSpan(
            { name: `${c.req.method} ${c.req.path}`, op: 'http.server', forceTransaction: true },
            async (span) => {
              try {
                await next();
              } finally {
                span.updateName(`${c.req.method} ${routePath(c, -1)}`);
                Sentry.setHttpStatus(span, c.res.status);
              }
            },
          ),
      ),
    );
    await Sentry.flush(2000);
  };
}

/**
 * Reports an unhandled error, tagged with the route pattern (no ids), and waits for it to be sent:
 * a Lambda is frozen once it answers.
 */
export async function reportError(err: unknown, route: string) {
  Sentry.captureException(err, { tags: { route } });
  await Sentry.flush(2000);
}
