import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp, withBasePath } from './app';
import { createAuth, type AuthConfig } from './auth';
import { createDb } from './db/client';
import { migrate } from './db/migrate';
import { createTestDatabase, DATABASE_URL, signInAsGuest, testApp, testReceipts } from './test-db';

// A PR preview serves the API under /pr-123 on a shared HTTP API, and the web app under /pr-123
// on a shared CloudFront (docs/plans/e2e-live-environments.md). dev and production have no path.
const config: AuthConfig = {
  baseURL: 'https://api.example.com/pr-123',
  webURL: 'https://d1234.cloudfront.net/pr-123',
  secret: 'test-secret-at-least-32-characters-long',
  google: { clientId: 'test', clientSecret: 'test' },
};
const unused = () => createDb(postgres('postgres://localhost/unused'));

describe('withBasePath', () => {
  it('serves the app as is when the API URL has no path', () => {
    const app = testApp(unused());
    expect(withBasePath(app, 'https://abc.execute-api.us-east-2.amazonaws.com')).toBe(app);
    expect(withBasePath(app, 'https://abc.execute-api.us-east-2.amazonaws.com/')).toBe(app);
  });

  it('serves the app only under the path of the API URL', async () => {
    const app = withBasePath(testApp(unused()), config.baseURL);
    expect(await (await app.request('/pr-123/health')).json()).toEqual({ ok: true });
    expect((await app.request('/health')).status).toBe(404);
  });

  it('answers CORS preflights under the path', async () => {
    const app = withBasePath(testApp(unused()), config.baseURL);
    const res = await app.request('/pr-123/api/auth/sign-in/anonymous', {
      method: 'OPTIONS',
      headers: {
        origin: 'https://d1234.cloudfront.net',
        'access-control-request-method': 'POST',
      },
    });
    expect(res.status).toBe(204);
  });
});

describe.skipIf(!DATABASE_URL)('auth under a path', () => {
  let sql: Sql;
  let drop: () => Promise<void>;
  let app: ReturnType<typeof testApp>;

  beforeAll(async () => {
    ({ sql, drop } = await createTestDatabase());
    await migrate(sql, { dsql: false });
    const db = createDb(sql);
    const auth = createAuth(db, config);
    const inner = createApp(auth, db, async () => {}, { stage: 'test' }, testReceipts().store);
    app = withBasePath(inner, config.baseURL);
  });

  afterAll(() => drop());

  it('signs in a guest and accepts their token', async () => {
    const res = await app.request('/pr-123/api/auth/sign-in/anonymous', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://d1234.cloudfront.net' },
      body: JSON.stringify({ name: 'Dana' }),
    });
    expect(res.status).toBe(200);
    const { token } = (await res.json()) as { token: string };
    const me = await app.request('/pr-123/me', { headers: { authorization: `Bearer ${token}` } });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ displayName: 'Dana' });
  });

  it('rejects the unprefixed path', async () => {
    await expect(signInAsGuest(app, 'Dana')).rejects.toThrow('404');
  });
});
