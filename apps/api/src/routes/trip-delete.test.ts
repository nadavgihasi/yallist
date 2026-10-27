import { testClient } from 'hono/testing';
import type { Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb } from '../db/client';
import { migrate } from '../db/migrate';
import { createTestDatabase, DATABASE_URL, signInAsGuest, testApp, testReceipts } from '../test-db';

describe.skipIf(!DATABASE_URL)('deleting a trip', () => {
  let sql: Sql;
  let drop: () => Promise<void>;
  let app: ReturnType<typeof testApp>;
  let client: ReturnType<typeof testClient<ReturnType<typeof testApp>>>;
  const bucket = testReceipts();
  const published: string[] = [];

  beforeAll(async () => {
    ({ sql, drop } = await createTestDatabase());
    await migrate(sql, { dsql: false });
    app = testApp(
      createDb(sql),
      async (tripId) => void published.push(tripId),
      undefined,
      bucket.store,
    );
    client = testClient(app);
  });

  afterAll(() => drop());

  type Guest = Awaited<ReturnType<typeof signInAsGuest>>;
  const as = (user: Guest) => ({ headers: user.headers });
  const trip = (tripId: string) => client.trips[':tripId'];
  const remove = (user: Guest, tripId: string) =>
    trip(tripId).$delete({ param: { tripId } }, as(user));

  /** Every row of every table that belongs to the trip, by table. */
  const rowsOf = async (tripId: string) => {
    const [counts] = await sql<Record<string, string>[]>`
      select
        (select count(*) from trips where id = ${tripId}) as trips,
        (select count(*) from trip_members where trip_id = ${tripId}) as members,
        (select count(*) from trip_categories where trip_id = ${tripId}) as categories,
        (select count(*) from items where trip_id = ${tripId}) as items,
        (select count(*) from claims where item_id in
          (select id from items where trip_id = ${tripId})) as claims,
        (select count(*) from expenses where trip_id = ${tripId}) as expenses,
        (select count(*) from expense_shares where expense_id in
          (select id from expenses where trip_id = ${tripId})) as shares,
        (select count(*) from payments where trip_id = ${tripId}) as payments,
        (select count(*) from activity where trip_id = ${tripId}) as activity`;
    return Object.fromEntries(Object.entries(counts!).map(([k, v]) => [k, Number(v)]));
  };

  /**
   * A grill trip with something in every table: `a` organizes, `b` is a member who claimed an
   * item and paid an expense with a receipt, `p` waits for approval; one item is soft-deleted,
   * `b` paid `a` back.
   */
  async function fullTrip() {
    const [a, b, p] = await Promise.all(['a', 'b', 'p'].map((n) => signInAsGuest(app, n)));
    const json = {
      name: 'Grill',
      startsOn: '2026-11-05',
      endsOn: '2026-11-05',
      template: 'grill' as const,
      requireApproval: true,
    };
    const data = await (await client.trips.$post({ json }, as(a!))).json();
    const tripId = data.trip.id;
    const param = { tripId };
    for (const user of [b!, p!]) {
      const token = data.inviteToken;
      await client.invites[':token'].join.$post({ param: { token }, json: {} }, as(user));
    }
    await trip(tripId).members[':userId'].approve.$post(
      { param: { tripId, userId: b!.id } },
      as(a!),
    );

    const [first, second] = data.items;
    await trip(tripId).items[':itemId'].claim.$put(
      { param: { tripId, itemId: first!.id }, json: { quantity: 1 } },
      as(b!),
    );
    await trip(tripId).items[':itemId'].$delete({ param: { tripId, itemId: second!.id } }, as(b!));

    const expense = await (
      await trip(tripId).expenses.$post(
        { param, json: { description: 'פחמים', amountAgorot: 1000, shares: [a!.id, b!.id] } },
        as(b!),
      )
    ).json();
    const expenseParam = { tripId, expenseId: expense.id };
    const receipt = trip(tripId).expenses[':expenseId'].receipt;
    const form = await (
      await receipt['upload-url'].$post(
        { param: expenseParam, json: { contentType: 'image/jpeg', size: 4 } },
        as(b!),
      )
    ).json();
    const body = new FormData();
    for (const [name, value] of Object.entries(form.fields)) body.append(name, value);
    body.append('file', new Blob(['jpeg'], { type: 'image/jpeg' }));
    await bucket.routes.request(new URL(form.url).pathname, { method: 'POST', body });
    expect(
      (await receipt.$post({ param: expenseParam, json: { key: form.key } }, as(b!))).status,
    ).toBe(204);

    await trip(tripId).payments.$post(
      { param, json: { toUser: a!.id, amountAgorot: 500 } },
      as(b!),
    );
    return { a: a!, b: b!, p: p!, tripId, receiptKey: form.key };
  }

  it('deletes everything in the trip and its receipts, and tells its subscribers', async () => {
    const { a, b, tripId, receiptKey } = await fullTrip();
    const before = await rowsOf(tripId);
    for (const [table, n] of Object.entries(before)) {
      expect(n, table).toBeGreaterThan(0);
    }
    expect(bucket.objects.has(receiptKey)).toBe(true);

    published.length = 0;
    expect((await remove(a, tripId)).status).toBe(204);

    expect(Object.values(await rowsOf(tripId))).toEqual(Object.values(before).map(() => 0));
    expect(bucket.objects.has(receiptKey)).toBe(false);
    expect(published).toEqual([tripId]);
    // Gone for everyone: open clients refetch on the event and get a 404.
    for (const user of [a, b]) {
      expect((await trip(tripId).$get({ param: { tripId } }, as(user))).status).toBe(404);
    }
    const mine = await (await client.trips.$get({}, as(b))).json();
    expect(mine.trips.map((t) => t.trip.id)).not.toContain(tripId);
  });

  it('deletes an activity log longer than one transaction may change', async () => {
    const a = await signInAsGuest(app, 'a');
    const json = {
      name: 'x',
      startsOn: '2026-11-05',
      endsOn: '2026-11-05',
      template: 'blank' as const,
    };
    const { trip: created } = await (await client.trips.$post({ json }, as(a))).json();
    await sql`
      insert into activity (trip_id, actor, type)
      select ${created.id}, ${a.id}, 'claim_set' from generate_series(1, 4500)`;

    expect((await remove(a, created.id)).status).toBe(204);
    expect((await rowsOf(created.id)).activity).toBe(0);
    expect((await rowsOf(created.id)).trips).toBe(0);
  });

  it('lets only organizers delete it', async () => {
    const { b, p, tripId } = await fullTrip();
    const stranger = await signInAsGuest(app, 'stranger');
    published.length = 0;

    expect((await remove(b, tripId)).status).toBe(403);
    // Pending members and strangers can't tell that it exists.
    expect((await remove(p, tripId)).status).toBe(404);
    expect((await remove(stranger, tripId)).status).toBe(404);

    expect((await rowsOf(tripId)).trips).toBe(1);
    expect((await rowsOf(tripId)).activity).toBeGreaterThan(0);
    expect(published).toEqual([]);
  });

  it('answers 404 the second time', async () => {
    const { a, tripId } = await fullTrip();
    expect((await remove(a, tripId)).status).toBe(204);
    expect((await remove(a, tripId)).status).toBe(404);
  });

  it('leaves other trips alone', async () => {
    const one = await fullTrip();
    const other = await fullTrip();
    const before = await rowsOf(other.tripId);
    expect((await remove(one.a, one.tripId)).status).toBe(204);
    expect(await rowsOf(other.tripId)).toEqual(before);
    expect(bucket.objects.has(other.receiptKey)).toBe(true);
  });
});
