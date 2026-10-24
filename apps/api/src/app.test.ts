import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from './app';
import { createAuth, mergeUser } from './auth';
import { createDb, type Db } from './db/client';
import { migrate } from './db/migrate';
import { createTestDatabase, DATABASE_URL } from './test-db';

function testApp(db: Db) {
  const auth = createAuth(db, {
    baseURL: 'http://localhost:3000',
    webURL: 'http://localhost:8081',
    secret: 'test-secret-at-least-32-characters-long',
    google: { clientId: 'test', clientSecret: 'test' },
  });
  return createApp(auth, db);
}

describe('GET /health', () => {
  it('returns ok', async () => {
    // Never connects: the route doesn't touch the database.
    const app = testApp(createDb(postgres('postgres://localhost/unused')));
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe.skipIf(!DATABASE_URL)('auth', () => {
  let sql: Sql;
  let drop: () => Promise<void>;
  let db: Db;
  let app: ReturnType<typeof testApp>;

  beforeAll(async () => {
    ({ sql, drop } = await createTestDatabase());
    await migrate(sql, { dsql: false });
    db = createDb(sql);
    app = testApp(db);
  });

  afterAll(() => drop());

  async function signInAsGuest(name: string) {
    const res = await app.request('/api/auth/sign-in/anonymous', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { token: string; user: { id: string } };
    return { token: body.token, id: body.user.id };
  }

  const me = (token?: string) =>
    app.request('/me', { headers: token ? { authorization: `Bearer ${token}` } : {} });

  it('signs in a guest and returns their profile for the bearer token', async () => {
    const { token, id } = await signInAsGuest('דנה');
    const res = await me(token);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id, displayName: 'דנה' });
  });

  it('rejects requests without a valid token', async () => {
    expect((await me()).status).toBe(401);
    expect((await me('not-a-token')).status).toBe(401);
  });

  it('moves a guest’s data to the account they link, keeping the stronger membership on overlap', async () => {
    const guest = await signInAsGuest('guest');
    const account = await signInAsGuest('account');
    const [trip] = await sql<{ id: string }[]>`
      insert into trips (name, starts_on, ends_on, template, invite_token, created_by)
      values ('Trip', '2026-11-01', '2026-11-02', 'camp', 'token', ${guest.id}) returning id`;
    await sql`
      insert into trip_members (trip_id, user_id, role, status, display_name)
      values (${trip!.id}, ${guest.id}, 'organizer', 'active', 'guest'),
             (${trip!.id}, ${account.id}, 'member', 'active', 'account')`;

    await mergeUser(db, guest.id, account.id);

    // The guest organized the trip, so the account takes over as organizer.
    expect(await sql`select user_id, role from trip_members`).toEqual([
      { user_id: account.id, role: 'organizer' },
    ]);
    expect(await sql`select created_by from trips`).toEqual([{ created_by: account.id }]);
    expect(await sql`select id from profiles where id = ${guest.id}`).toEqual([]);
  });

  it('keeps the stronger role and status of overlapping memberships', async () => {
    const guest = await signInAsGuest('guest');
    const account = await signInAsGuest('account');
    const trips = await sql<{ id: string }[]>`
      insert into trips (name, starts_on, ends_on, template, invite_token, created_by)
      values ('A', '2026-11-01', '2026-11-02', 'camp', 'token-a', ${account.id}),
             ('B', '2026-11-01', '2026-11-02', 'camp', 'token-b', ${account.id})
      returning id`;
    const [a, b] = trips.map((t) => t.id);
    await sql`
      insert into trip_members (trip_id, user_id, role, status, display_name) values
        (${a!}, ${guest.id}, 'member', 'active', 'guest'),
        (${a!}, ${account.id}, 'member', 'pending', 'account'),
        (${b!}, ${guest.id}, 'member', 'pending', 'guest'),
        (${b!}, ${account.id}, 'organizer', 'active', 'account')`;

    await mergeUser(db, guest.id, account.id);

    const rows = await sql`
      select trip_id, user_id, role, status from trip_members
      where trip_id in (${a!}, ${b!}) order by trip_id = ${b!}`;
    expect(rows).toEqual([
      { trip_id: a, user_id: account.id, role: 'member', status: 'active' },
      { trip_id: b, user_id: account.id, role: 'organizer', status: 'active' },
    ]);
  });
});
