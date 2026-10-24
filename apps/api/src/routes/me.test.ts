import type { Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb } from '../db/client';
import { migrate } from '../db/migrate';
import { createTestDatabase, DATABASE_URL, signInAsGuest, testApp } from '../test-db';

describe.skipIf(!DATABASE_URL)('GET and PATCH /me', () => {
  let sql: Sql;
  let drop: () => Promise<void>;
  let app: ReturnType<typeof testApp>;

  beforeAll(async () => {
    ({ sql, drop } = await createTestDatabase());
    await migrate(sql, { dsql: false });
    app = testApp(createDb(sql));
  });

  afterAll(() => drop());

  const patch = (headers: Record<string, string>, body: unknown) =>
    app.request('/me', {
      method: 'PATCH',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('returns the profile with the account type, defaults on', async () => {
    const guest = await signInAsGuest(app, 'דנה');
    const res = await app.request('/me', { headers: guest.headers });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: guest.id,
      displayName: 'דנה',
      avatarColor: expect.stringMatching(/^#[0-9A-F]{6}$/),
      paymentPhone: null,
      notifyUpdates: true,
      notifyDayBefore: true,
      notifySettle: true,
      account: { type: 'guest', email: null },
    });
  });

  it('updates the given fields, normalizing the phone, and keeps the rest', async () => {
    const guest = await signInAsGuest(app, 'דנה');
    const res = await patch(guest.headers, {
      displayName: '  דנה כהן ',
      avatarColor: '#D8F0E0',
      paymentPhone: '050-123 4567',
      notifySettle: false,
    });
    expect(res.status).toBe(200);
    const expected = {
      displayName: 'דנה כהן',
      avatarColor: '#D8F0E0',
      paymentPhone: '+972501234567',
      notifyUpdates: true,
      notifySettle: false,
    };
    expect(await res.json()).toMatchObject(expected);
    const again = await app.request('/me', { headers: guest.headers });
    expect(await again.json()).toMatchObject(expected);

    const cleared = await patch(guest.headers, { paymentPhone: '' });
    expect(await cleared.json()).toMatchObject({ paymentPhone: null, displayName: 'דנה כהן' });
  });

  it('keeps trip names as they were when joined', async () => {
    const guest = await signInAsGuest(app, 'old');
    const [trip] = await sql<{ id: string }[]>`
      insert into trips (name, starts_on, ends_on, template, invite_token, created_by)
      values ('Trip', '2026-11-01', '2026-11-02', 'camp', 'me-token', ${guest.id}) returning id`;
    await sql`
      insert into trip_members (trip_id, user_id, role, status, display_name)
      values (${trip!.id}, ${guest.id}, 'organizer', 'active', 'old')`;
    await patch(guest.headers, { displayName: 'new' });
    expect(await sql`select display_name from trip_members where trip_id = ${trip!.id}`).toEqual([
      { display_name: 'old' },
    ]);
  });

  it.each([
    { displayName: '   ' },
    { displayName: 'x'.repeat(51) },
    { avatarColor: '#000000' },
    { paymentPhone: '03-1234567' },
    { paymentPhone: 501234567 },
    { notifyUpdates: 'yes' },
    { id: '00000000-0000-0000-0000-000000000000' },
  ])('rejects %o with 400', async (body) => {
    const guest = await signInAsGuest(app, 'דנה');
    expect((await patch(guest.headers, body)).status).toBe(400);
  });

  it('requires a session', async () => {
    expect((await app.request('/me')).status).toBe(401);
    expect((await patch({}, { displayName: 'x' })).status).toBe(401);
    expect((await patch({ authorization: 'Bearer nope' }, { displayName: 'x' })).status).toBe(401);
  });
});
