import { testClient } from 'hono/testing';
import type { Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { deleteTrip } from '../dal/trips';
import { createDb, type Db } from '../db/client';
import { migrate } from '../db/migrate';
import {
  createTestDatabase,
  DATABASE_URL,
  foreignKeys,
  signInAsGuest,
  testApp,
  testReceipts,
} from '../test-db';

describe.skipIf(!DATABASE_URL)('deleting a trip', () => {
  let sql: Sql;
  let db: Db;
  let drop: () => Promise<void>;
  let app: ReturnType<typeof testApp>;
  let client: ReturnType<typeof testClient<ReturnType<typeof testApp>>>;
  const bucket = testReceipts();
  const published: string[] = [];

  beforeAll(async () => {
    ({ sql, drop } = await createTestDatabase());
    await migrate(sql, { dsql: false });
    db = createDb(sql);
    app = testApp(db, async (tripId) => void published.push(tripId), undefined, bucket.store);
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
        (select count(*) from expense_items where expense_id in
          (select id from expenses where trip_id = ${tripId})) as expense_items,
        (select count(*) from expense_parts where expense_id in
          (select id from expenses where trip_id = ${tripId})) as expense_parts,
        (select count(*) from expense_part_shares where part_id in
          (select id from expense_parts where expense_id in
            (select id from expenses where trip_id = ${tripId}))) as part_shares,
        (select count(*) from shopping_runs where trip_id = ${tripId}) as shopping_runs,
        (select count(*) from payments where trip_id = ${tripId}) as payments,
        (select count(*) from activity where trip_id = ${tripId}) as activity`;
    return Object.fromEntries(Object.entries(counts!).map(([k, v]) => [k, Number(v)]));
  };

  /**
   * A grill trip with something in every table: `a` organizes, `b` is a member who claimed an
   * item and paid an expense with a receipt, `p` waits for approval; one item is soft-deleted,
   * `b` paid `a` back. `b` finished a shopping run (one item bought, one returned; a part of it
   * split apart) and `a` has one open.
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
    const [x, y, z] = data.items.filter((i) => i.list === 'buy' && i.kind !== 'each');
    const runs = trip(tripId).runs;
    const started = await (
      await runs.$post({ param, json: { itemIds: [x!.id, y!.id] } }, as(b!))
    ).json();
    await trip(tripId).items[':itemId'].cart.$put(
      { param: { tripId, itemId: x!.id }, json: { inCart: true } },
      as(b!),
    );
    const finished = await runs[':runId'].finish.$post(
      {
        param: { tripId, runId: started.run!.id },
        json: {
          amountAgorot: 900,
          shares: [b!.id],
          parts: [{ label: 'אלכוהול', amountAgorot: 400, shares: [a!.id, b!.id] }],
        },
      },
      as(b!),
    );
    expect(finished.status).toBe(201);
    await runs.$post({ param, json: { itemIds: [z!.id] } }, as(a!));
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

  /** The tables that hang off trips: they reference trips.id, or a table that does, and so on. */
  async function tripTables() {
    const fks = await foreignKeys(sql);
    const found = new Map<string, string>([['trips', 'trips']]);
    for (let grew = true; grew;) {
      grew = false;
      for (const fk of fks) {
        if (found.has(fk.refTable) && !found.has(fk.table)) {
          found.set(fk.table, `${fk.table}.${fk.column} -> ${found.get(fk.refTable)}`);
          grew = true;
        }
      }
    }
    return found;
  }

  const countRows = async (tables: string[]) =>
    Object.fromEntries(
      await Promise.all(
        tables.map(async (t) => {
          const [row] = await sql<[{ n: number }]>`select count(*)::int as n from ${sql(t)}`;
          return [t, row.n] as const;
        }),
      ),
    );

  // deleteTrip deletes children first by hand (no cascades on DSQL). The tables come from the
  // schema's foreign keys, so a new table under a trip fails here until fullTrip writes a row to
  // it and deleteTrip deletes it.
  it('deleteTrip deletes from every table that hangs off a trip', async () => {
    const tables = await tripTables();
    // Sanity: the walk follows foreign keys through items, expenses and their parts.
    expect([...tables.keys()]).toEqual(
      expect.arrayContaining(['trip_members', 'claims', 'expense_part_shares', 'expense_items']),
    );
    const names = [...tables.keys()];
    const before = await countRows(names);
    const { tripId } = await fullTrip();
    const filled = await countRows(names);
    const empty = names.filter((t) => filled[t]! <= before[t]!).map((t) => tables.get(t));
    expect(
      empty,
      `Tables hang off trips but fullTrip writes no row to them: ${empty.join('; ')}. Make ` +
        'fullTrip fill them, and deleteTrip (dal/trips.ts) delete their rows before the rows ' +
        'they reference',
    ).toEqual([]);

    // An FK error names the table deleteTrip deletes too early or leaves behind.
    await db.transaction((tx) => deleteTrip(tx, tripId));

    const after = await countRows(names);
    const left = names
      .filter((t) => after[t] !== before[t])
      .map((t) => `${tables.get(t)}: ${after[t]! - before[t]!} left`);
    expect(left, `deleteTrip (dal/trips.ts) leaves rows of the trip: ${left.join('; ')}`).toEqual(
      [],
    );
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
