import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';

import type { Auth } from './auth';
import type { Db } from './db/client';
import type { Publish } from './realtime';
import type { ReceiptStore } from './receipts';
import { categoryRoutes } from './routes/categories';
import { feedbackRoutes, type FeedbackConfig } from './routes/feedback';
import { inviteRoutes } from './routes/invites';
import { itemRoutes } from './routes/items';
import { meRoutes } from './routes/me';
import { moneyRoutes } from './routes/money';
import { receiptRoutes } from './routes/receipts';
import { sentryWebhookRoutes, type SentryWebhookConfig } from './routes/sentry-webhook';
import { tripRoutes } from './routes/trips';
import { reportError } from './sentry';

export function createApp(
  auth: Auth,
  db: Db,
  publish: Publish,
  feedback: FeedbackConfig,
  receipts: ReceiptStore,
  sentryWebhook: SentryWebhookConfig = { secret: null, telegram: null },
) {
  // Realtime is best effort: a failed publish is logged, the write has already succeeded.
  const notify = (tripId: string) =>
    publish(tripId).catch((err: unknown) => console.error('Realtime publish failed', err));

  // Answers CORS preflights with a 2xx: API Gateway's `$default` route forwards them to this
  // Lambda. Deployed, API Gateway replaces these headers with its own (infra/app/core.ts);
  // locally, they're the ones the browser sees.
  return new Hono()
    .use(cors())
    .onError(async (err, c) => {
      if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
      // Not `err` itself: Drizzle's message lists the query parameters (invite tokens, names).
      console.error(err.cause ?? err);
      await reportError(err.cause ?? err, `${c.req.method} ${c.req.routePath}`);
      return c.json({ error: 'Internal error' }, 500);
    })
    .get('/health', (c) => c.json({ ok: true }))
    .on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))
    .route('/webhooks/sentry', sentryWebhookRoutes(sentryWebhook))
    .route('/me', meRoutes(auth, db, receipts))
    .route('/feedback', feedbackRoutes(auth, db, feedback))
    .use('/trips/:tripId/*', async (c, next) => {
      await next();
      // After every successful write to a trip, so after its transaction committed.
      if (c.req.method !== 'GET' && c.res.ok) await notify(c.req.param('tripId'));
    })
    .route('/trips', tripRoutes(auth, db, receipts))
    .route('/trips', categoryRoutes(auth, db))
    .route('/trips', itemRoutes(auth, db))
    .route('/trips', moneyRoutes(auth, db, receipts))
    .route('/trips', receiptRoutes(auth, db, receipts))
    .route('/invites', inviteRoutes(auth, db, notify));
}

/**
 * Serves `app` under the path of the API's public URL: a PR preview shares an HTTP API with
 * other PRs and gets `/pr-123/*` (infra/app/stacks/preview-pr.ts). Elsewhere the URL has no path.
 */
export function withBasePath(app: Hono, apiURL: string) {
  const basePath = new URL(apiURL).pathname.replace(/\/$/, '');
  return basePath ? new Hono().route(basePath, app) : app;
}

/** For the typed `hc` client in the app. */
export type AppType = ReturnType<typeof createApp>;
