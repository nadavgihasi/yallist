import { Hono } from 'hono';

export const app = new Hono().get('/health', (c) => c.json({ ok: true }));

/** For the typed `hc` client in the app. */
export type AppType = typeof app;
