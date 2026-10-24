import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { requireUser, type Auth } from './auth';
import type { Db } from './db/client';
import { profiles } from './db/schema';

export function createApp(auth: Auth, db: Db) {
  return new Hono()
    .get('/health', (c) => c.json({ ok: true }))
    .on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))
    .get('/me', requireUser(auth), async (c) => {
      const [profile] = await db.select().from(profiles).where(eq(profiles.id, c.var.user.id));
      return profile ? c.json(profile) : c.notFound();
    });
}

/** For the typed `hc` client in the app. */
export type AppType = ReturnType<typeof createApp>;
