import * as Sentry from '@sentry/node-core/light';
import { scrubEvent } from '@yallist/domain';

/**
 * Starts Sentry in this Lambda: every error, no traces (CloudWatch alarms watch latency). The
 * light SDK (no OpenTelemetry) keeps the bundle and cold start small. Without a DSN (unset or
 * SST's `unset` placeholder: local, tests) nothing is started and reportError only logs.
 */
export function initSentry(dsn: string | undefined, environment: string) {
  if (!dsn || dsn === 'unset') return;
  Sentry.init({
    dsn,
    environment,
    // Set by infra/app/sst.config.ts from the release tag.
    release: process.env.SENTRY_RELEASE,
    sampleRate: 1,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    // Local variables could hold personal data; sessions don't fit a Lambda.
    integrations: (defaults) =>
      defaults.filter((i) => !['LocalVariables', 'ProcessSession'].includes(i.name)),
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubEvent,
  });
}

/**
 * Reports an unhandled error, tagged with the route pattern (no ids), and waits for it to be sent:
 * a Lambda is frozen once it answers.
 */
export async function reportError(err: unknown, route: string) {
  Sentry.captureException(err, { tags: { route } });
  await Sentry.flush(2000);
}
