import { testClient } from 'hono/testing';
import type { Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DELETED_NAME } from '../dal/profiles';
import { createDb } from '../db/client';
import { migrate } from '../db/migrate';
import { createTestDatabase, DATABASE_URL, signInAsGuest, testApp, testReceipts } from '../test-db';

describe.skipIf(!DATABASE_URL)('DELETE /me', () => {
  let sql: Sql;
  let drop: () => Promise<void>;
  let app: ReturnType<typeof testApp>;
  let client: ReturnType<typeof testClient<ReturnType<typeof testApp>>>;
  const bucket = testReceipts();

  beforeAll(async () => {
    ({ sql, drop } = await createTestDatabase());
    await migrate(sql, { dsql: false });
    app = testApp(createDb(sql), undefined, undefined, bucket.store);
    client = testClient(app);
  });

  afterAll(() => drop());

  type Guest = Awaited<ReturnType<typeof signInAsGuest>>;
  const as = (user: Guest) => ({ headers: user.headers });
  const deleteMe = (user: Guest) => client.me.$delete({}, as(user));

  async function createTrip(user: Guest, requireApproval = false) {
    const res = await client.trips.$post(
      {
        json: {
          name: 'צפון',
          startsOn: '2026-11-05',
          endsOn: '2026-11-07',
          template: 'blank',
          requireApproval,
        },
      },
      as(user),
    );
    expect(res.status).toBe(201);
    return res.json();
  }
  const join = (user: Guest, token: string) =>
    client.invites[':token'].join.$post({ param: { token }, json: {} }, as(user));

  async function setPhoto(user: Guest) {
    const form = await (
      await client.me.avatar['upload-url'].$post(
        { json: { contentType: 'image/jpeg', size: 4 } },
        as(user),
      )
    ).json();
    const body = new FormData();
    for (const [name, value] of Object.entries(form.fields)) body.append(name, value);
    body.append('file', new Blob(['jpeg']));
    await bucket.routes.request(new URL(form.url).pathname, { method: 'POST', body });
    expect((await client.me.avatar.$post({ json: { key: form.key } }, as(user))).status).toBe(200);
    return form.key;
  }

  const rowCount = async (table: string, column: string, id: string) =>
    Number((await sql`select count(*) as n from ${sql(table)} where ${sql(column)} = ${id}`)[0]!.n);

  it('refuses while the user is in a trip, as organizer or member', async () => {
    const organizer = await signInAsGuest(app, 'דנה');
    const member = await signInAsGuest(app, 'רון');
    const data = await createTrip(organizer);
    expect((await join(member, data.inviteToken)).status).toBe(200);

    for (const user of [organizer, member]) {
      expect((await deleteMe(user)).status).toBe(409);
      expect((await client.me.$get({}, as(user))).status).toBe(200);
    }
  });

  it('deletes a user who was never in a trip, with their photo, feedback and sessions', async () => {
    const user = await signInAsGuest(app, 'דנה');
    const photo = await setPhoto(user);
    await sql`
      insert into feedback (user_id, title, body, app_version, platform, stage)
      values (${user.id}, 'idea', 'text', '1.0.0', 'web', 'test')`;

    expect((await deleteMe(user)).status).toBe(204);

    for (const [table, column] of [
      ['users', 'id'],
      ['profiles', 'id'],
      ['sessions', 'user_id'],
      ['accounts', 'user_id'],
      ['feedback', 'user_id'],
    ] as const) {
      expect(await rowCount(table, column, user.id)).toBe(0);
    }
    expect(await bucket.store.head(photo)).toBeUndefined();
    // Signed out everywhere.
    expect((await client.me.$get({}, as(user))).status).toBe(401);
  });

  it('can delete once they deleted their trip', async () => {
    const user = await signInAsGuest(app, 'דנה');
    const data = await createTrip(user);
    expect((await deleteMe(user)).status).toBe(409);
    const tripId = data.trip.id;
    expect((await client.trips[':tripId'].$delete({ param: { tripId } }, as(user))).status).toBe(
      204,
    );
    expect((await deleteMe(user)).status).toBe(204);
    expect(await rowCount('users', 'id', user.id)).toBe(0);
  });

  it('withdraws requests to join a trip', async () => {
    const organizer = await signInAsGuest(app, 'דנה');
    const user = await signInAsGuest(app, 'רון');
    const data = await createTrip(organizer, true);
    expect(await (await join(user, data.inviteToken)).json()).toMatchObject({ status: 'pending' });

    expect((await deleteMe(user)).status).toBe(204);
    expect(await rowCount('trip_members', 'user_id', user.id)).toBe(0);
    expect(await rowCount('users', 'id', user.id)).toBe(0);
  });

  it('keeps what they did in a trip they were removed from, without their name', async () => {
    const organizer = await signInAsGuest(app, 'דנה');
    const user = await signInAsGuest(app, 'רון');
    await setPhoto(user);
    await client.me.$patch({ json: { paymentPhone: '0501234567' } }, as(user));
    const data = await createTrip(organizer);
    const tripId = data.trip.id;
    expect((await join(user, data.inviteToken)).status).toBe(200);
    const res = await client.trips[':tripId'].expenses.$post(
      {
        param: { tripId },
        json: { description: 'דלק', amountAgorot: 10000, shares: [user.id, organizer.id] },
      },
      as(user),
    );
    expect(res.status).toBe(201);
    expect(
      (
        await client.trips[':tripId'].members[':userId'].$delete(
          { param: { tripId, userId: user.id } },
          as(organizer),
        )
      ).status,
    ).toBe(200);

    expect((await deleteMe(user)).status).toBe(204);

    expect(await rowCount('expenses', 'paid_by', user.id)).toBe(1);
    expect(await sql`select display_name from trip_members where user_id = ${user.id}`).toEqual([
      { display_name: DELETED_NAME },
    ]);
    expect(
      await sql`select display_name, avatar_key, payment_phone from profiles where id = ${user.id}`,
    ).toEqual([{ display_name: DELETED_NAME, avatar_key: null, payment_phone: null }]);
    expect(await sql`select name, email, image from users where id = ${user.id}`).toEqual([
      { name: DELETED_NAME, email: `deleted-${user.id}@deleted.invalid`, image: null },
    ]);
    expect(await rowCount('sessions', 'user_id', user.id)).toBe(0);
    expect(await rowCount('accounts', 'user_id', user.id)).toBe(0);
    expect((await client.me.$get({}, as(user))).status).toBe(401);
  });

  it('needs a session', async () => {
    expect((await app.request('/me', { method: 'DELETE' })).status).toBe(401);
  });
});
