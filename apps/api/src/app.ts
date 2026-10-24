import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';

import type { Auth } from './auth';
import type { Db } from './db/client';
import type { Publish } from './realtime';
import { categoryRoutes } from './routes/categories';
import { inviteRoutes } from './routes/invites';
import { itemRoutes } from './routes/items';
import { meRoutes } from './routes/me';
import { moneyRoutes } from './routes/money';
import { tripRoutes } from './routes/trips';

export function createApp(auth: Auth, db: Db, publish: Publish) {
  // Realtime is best effort: a failed publish is logged, the write has already succeeded.
  const notify = (tripId: string) =>
    publish(tripId).catch((err: unknown) => console.error('Realtime publish failed', err));

  // Answers CORS preflights with a 2xx: API Gateway's `$default` route forwards them to this
  // Lambda. Deployed, API Gateway replaces these headers with its own (infra/app/sst.config.ts);
  // locally, they're the ones the browser sees.
  return new Hono()
    .use(cors())
    .onError((err, c) => {
      if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
      // Not `err` itself: Drizzle's message lists the query parameters (invite tokens, names).
      console.error(err.cause ?? err);
      return c.json({ error: 'Internal error' }, 500);
    })
    .get('/health', (c) => c.json({ ok: true }))
    .on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))
    .route('/me', meRoutes(auth, db))
    .use('/trips/:tripId/*', async (c, next) => {
      await next();
      // After every successful write to a trip, so after its transaction committed.
      if (c.req.method !== 'GET' && c.res.ok) await notify(c.req.param('tripId'));
    })
    .route('/trips', tripRoutes(auth, db))
    .route('/trips', categoryRoutes(auth, db))
    .route('/trips', itemRoutes(auth, db))
    .route('/trips', moneyRoutes(auth, db))
    .route('/invites', inviteRoutes(auth, db, notify));
}

/** For the typed `hc` client in the app. */
export type AppType = ReturnType<typeof createApp>;
