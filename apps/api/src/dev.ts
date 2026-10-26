/**
 * The API on a local Node server, against plain Postgres, for running the app without AWS:
 *   DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres pnpm --filter @yallist/api dev
 * Migrates the database first. Google sign-in needs GOOGLE_CLIENT_ID (the dev OAuth client).
 */
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { createApp } from './app';
import { createAuth } from './auth';
import { connect, createDb } from './db/client';
import { migrate } from './db/migrate';
import { localReceiptStore } from './receipts-local';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to a local Postgres.');

const port = Number(process.env.PORT ?? 3000);

const sql = connect();
await migrate(sql, { dsql: false });
const db = createDb(sql);
// No realtime locally: publishing is a no-op. Receipts and profile photos stay in memory, served
// by this server. No GitHub token locally: feedback is only saved.
const receipts = localReceiptStore(`http://localhost:${port}/dev/receipts`);
const auth = createAuth(db, {
  baseURL: `http://localhost:${port}`,
  webURL: 'http://localhost:8081',
  secret: process.env.BETTER_AUTH_SECRET ?? 'local-dev-secret-at-least-32-characters',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? 'unset',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? 'unset',
  },
  photos: receipts.store,
});

const app = new Hono()
  .use('/dev/receipts/*', cors())
  .route('/dev/receipts', receipts.routes)
  .route(
    '/',
    createApp(auth, db, async () => {}, { stage: 'local' }, receipts.store),
  );

serve({ fetch: app.fetch, port }, () => console.log(`API on http://localhost:${port}`));
