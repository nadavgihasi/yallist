import { randomBytes } from 'node:crypto';

import postgres from 'postgres';

import { createApp } from './app';
import { createAuth } from './auth';
import type { Db } from './db/client';
import type { Publish } from './realtime';
import type { FeedbackConfig } from './routes/feedback';
import type { ReceiptStore } from './receipts';
import { localReceiptStore } from './receipts-local';

/** Postgres server for DB tests; CI provides one. Tests that need it skip without it. */
export const DATABASE_URL = process.env.DATABASE_URL;

/** Creates an empty, throwaway database on DATABASE_URL's server. */
export async function createTestDatabase() {
  const name = `yallist_test_${randomBytes(4).toString('hex')}`;
  const admin = postgres(DATABASE_URL!, { onnotice: () => {} });
  await admin.unsafe(`create database ${name}`);
  const url = new URL(DATABASE_URL!);
  url.pathname = `/${name}`;
  const sql = postgres(url.href, { onnotice: () => {} });
  return {
    sql,
    async drop() {
      await sql.end();
      await admin.unsafe(`drop database ${name}`);
      await admin.end();
    },
  };
}

/** Better Auth with test config. */
export const testAuth = (db: Db, photos?: ReceiptStore) =>
  createAuth(db, {
    photos,
    baseURL: 'http://localhost:3000',
    webURL: 'http://localhost:8081',
    secret: 'test-secret-at-least-32-characters-long',
    google: { clientId: 'test', clientSecret: 'test' },
  });

/** In-memory receipts bucket; tests upload through its `routes`. */
export const testReceipts = () => localReceiptStore('http://receipts.test');

/** The app with test auth config; realtime events go to `publish`, feedback isn't sent to GitHub. */
export const testApp = (
  db: Db,
  publish: Publish = async () => {},
  feedback: FeedbackConfig = { stage: 'test' },
  receipts = testReceipts().store,
) => createApp(testAuth(db, receipts), db, publish, feedback, receipts);

/** A new guest user, with the headers that authenticate as them. */
export async function signInAsGuest(app: ReturnType<typeof testApp>, name: string) {
  const res = await app.request('/api/auth/sign-in/anonymous', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (res.status !== 200) throw new Error(`Guest sign-in failed: ${res.status}`);
  const body = (await res.json()) as { token: string; user: { id: string } };
  return {
    id: body.user.id,
    token: body.token,
    headers: { authorization: `Bearer ${body.token}` },
  };
}
