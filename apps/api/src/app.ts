import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

import { requireUser, type Auth } from './auth';
import type { Db } from './db/client';
import { profiles } from './db/schema';
import { inviteRoutes } from './routes/invites';
import { itemRoutes } from './routes/items';
import { moneyRoutes } from './routes/money';
import { tripRoutes } from './routes/trips';

export function createApp(auth: Auth, db: Db) {
  return new Hono()
    .onError((err, c) => {
      if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
      // Not `err` itself: Drizzle's message lists the query parameters (invite tokens, names).
      console.error(err.cause ?? err);
      return c.json({ error: 'Internal error' }, 500);
    })
    .get('/health', (c) => c.json({ ok: true }))
    .on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))
    .get('/me', requireUser(auth), async (c) => {
      const [profile] = await db.select().from(profiles).where(eq(profiles.id, c.var.user.id));
      return profile ? c.json(profile) : c.notFound();
    })
    .route('/trips', tripRoutes(auth, db))
    .route('/trips', itemRoutes(auth, db))
    .route('/trips', moneyRoutes(auth, db))
    .route('/invites', inviteRoutes(auth, db));
}

/** For the typed `hc` client in the app. */
export type AppType = ReturnType<typeof createApp>;
