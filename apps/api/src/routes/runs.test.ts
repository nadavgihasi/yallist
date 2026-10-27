import { splitEqually } from '@yallist/domain';
import { testClient } from 'hono/testing';
import type { Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb } from '../db/client';
import { migrate } from '../db/migrate';
import { createTestDatabase, DATABASE_URL, signInAsGuest, testApp } from '../test-db';

describe.skipIf(!DATABASE_URL)('shopping runs', () => {
  let sql: Sql;
  let drop: () => Promise<void>;
  let app: ReturnType<typeof testApp>;
  let client: ReturnType<typeof testClient<ReturnType<typeof testApp>>>;

  beforeAll(async () => {
    ({ sql, drop } = await createTestDatabase());
    await migrate(sql, { dsql: false });
    app = testApp(createDb(sql));
    client = testClient(app);
  });

  afterAll(() => drop());

  type Guest = Awaited<ReturnType<typeof signInAsGuest>>;
  const as = (user: Guest) => ({ headers: user.headers });

  /** A grill trip with three active members; `a` organizes. `buy`: its shared buy item ids. */
  async function trip() {
    const [a, b, c] = await Promise.all(['a', 'b', 'c'].map((n) => signInAsGuest(app, n)));
    const res = await client.trips.$post(
      { json: { name: 'Grill', startsOn: '2026-11-05', endsOn: '2026-11-05', template: 'grill' } },
      as(a!),
    );
    const data = await res.json();
    for (const user of [b!, c!]) {
      await client.invites[':token'].join.$post(
        { param: { token: data.inviteToken }, json: {} },
        as(user),
      );
    }
    const buy = data.items.filter((i) => i.list === 'buy' && i.kind !== 'each').map((i) => i.id);
    return { a: a!, b: b!, c: c!, tripId: data.trip.id, buy };
  }

  const runs = () => client.trips[':tripId'].runs;
  const start = (user: Guest, tripId: string, itemIds: string[]) =>
    runs().$post({ param: { tripId }, json: { itemIds } }, as(user));
  const startOk = async (user: Guest, tripId: string, itemIds: string[]) => {
    const res = await start(user, tripId, itemIds);
    expect(res.status).toBe(200);
    return res.json();
  };
  const cart = (user: Guest, tripId: string, itemId: string, inCart = true) =>
    client.trips[':tripId'].items[':itemId'].cart.$put(
      { param: { tripId, itemId }, json: { inCart } },
      as(user),
    );
  const finish = (
    user: Guest,
    tripId: string,
    runId: string,
    json: { amountAgorot: number; shares: string[] },
  ) => runs()[':runId'].finish.$post({ param: { tripId, runId }, json }, as(user));
  const cancel = (user: Guest, tripId: string, runId: string) =>
    runs()[':runId'].cancel.$post({ param: { tripId, runId } }, as(user));
  const detail = async (user: Guest, tripId: string) =>
    (await client.trips[':tripId'].$get({ param: { tripId } }, as(user))).json();
  const activity = async (tripId: string, type: string) =>
    sql<{ payload: Record<string, unknown> }[]>`
      select payload from activity where trip_id = ${tripId} and type = ${type}`;

  it('claims every eligible item for the shopper and shows the run to everyone', async () => {
    const { a, b, tripId, buy } = await trip();
    const [taken, ...free] = buy.slice(0, 4) as [string, ...string[]];
    await client.trips[':tripId'].items[':itemId'].claim.$put(
      { param: { tripId, itemId: taken }, json: { quantity: 1 } },
      as(b),
    );

    const { run, claimed, skipped } = await startOk(a, tripId, [taken, ...free]);
    expect(run).toMatchObject({ shopperId: a.id });
    expect(claimed.sort()).toEqual([...free].sort());
    expect(skipped).toEqual([{ itemId: taken, claimedBy: b.id }]);

    const seen = await detail(b, tripId);
    expect(seen.runs).toEqual([run]);
    expect(seen.claims.filter((cl) => cl.runId === run!.id).map((cl) => cl.itemId)).toEqual(
      expect.arrayContaining(free),
    );
    expect(await activity(tripId, 'shopping_started')).toEqual([
      { payload: { runId: run!.id, count: free.length } },
    ]);

    // Starting again adds to the same run: one active run per shopper and trip.
    const again = await startOk(a, tripId, [buy[4]!]);
    expect(again.run!.id).toBe(run!.id);
    expect((await detail(a, tripId)).runs).toHaveLength(1);
  });

  it('never claims an item twice when two runs start at once', async () => {
    const { a, b, c, tripId, buy } = await trip();
    // Three shoppers race for overlapping items, several times over.
    for (let round = 0; round < 3; round++) {
      const results = await Promise.all([a, b, c].map((user) => startOk(user, tripId, buy)));
      const claimedCounts = new Map<string, number>();
      for (const { claimed } of results) {
        for (const id of claimed) claimedCounts.set(id, (claimedCounts.get(id) ?? 0) + 1);
      }
      expect([...claimedCounts.values()].every((n) => n === 1)).toBe(true);
      // Every item went to exactly one of them; the others got it back as skipped.
      for (const { claimed, skipped } of results) {
        expect([...claimed, ...skipped.map((s) => s.itemId)].sort()).toEqual([...buy].sort());
      }
      const { claims } = await detail(a, tripId);
      expect(claims.filter((cl) => buy.includes(cl.itemId))).toHaveLength(buy.length);
      for (const user of [a, b, c]) {
        const run = results.find((r) => r.run?.shopperId === user.id)?.run;
        if (run) expect((await cancel(user, tripId, run.id)).status).toBe(200);
      }
    }
  });

  it('finishes with one expense for what is in the cart, and releases the rest', async () => {
    const { a, b, c, tripId, buy } = await trip();
    const [x, y, z] = buy as [string, string, string];
    const { run } = await startOk(a, tripId, [x, y, z]);
    expect((await cart(a, tripId, x)).status).toBe(200);
    expect((await cart(a, tripId, y)).status).toBe(200);

    const res = await finish(a, tripId, run!.id, {
      amountAgorot: 48690,
      shares: [a.id, b.id, c.id],
    });
    expect(res.status).toBe(201);
    const expense = await res.json();
    expect(expense).toMatchObject({
      description: 'קניות · 2 פריטים',
      amountAgorot: 48690,
      paidBy: a.id,
    });
    expect([...expense.itemIds!].sort()).toEqual([x, y].sort());

    const after = await detail(b, tripId);
    expect(after.runs).toEqual([]);
    expect(after.expenses).toEqual([{ ...expense, itemIds: expect.arrayContaining([x, y]) }]);
    // The shopper keeps what they bought, out of the cart; the rest is unclaimed again.
    expect(after.claims.filter((cl) => [x, y, z].includes(cl.itemId))).toEqual(
      [x, y].map((itemId) => expect.objectContaining({ itemId, userId: a.id, runId: run!.id })),
    );
    expect(after.claims.some((cl) => cl.inCart)).toBe(false);
    const owed = splitEqually(48690, [a.id, b.id, c.id]);
    expect(after.balances).toEqual({
      [a.id]: 48690 - owed.get(a.id)!,
      [b.id]: -owed.get(b.id)!,
      [c.id]: -owed.get(c.id)!,
    });
    const [{ count }] = await sql<[{ count: number }]>`
      select count(*)::int as count from expense_items where expense_id = ${expense.id}`;
    expect(count).toBe(2);
    expect(await activity(tripId, 'shopping_finished')).toEqual([
      { payload: { runId: run!.id, expenseId: expense.id, count: 2, amountAgorot: 48690 } },
    ]);

    // Over: nothing more to do with it, and the released item is free for anyone.
    expect((await finish(a, tripId, run!.id, { amountAgorot: 1, shares: [a.id] })).status).toBe(
      409,
    );
    expect((await startOk(b, tripId, [z])).claimed).toEqual([z]);
    expect((await startOk(c, tripId, [x])).skipped).toEqual([{ itemId: x, claimedBy: a.id }]);
  });

  it('skips cart items bought or deleted meanwhile, and needs something to buy', async () => {
    const { a, tripId, buy } = await trip();
    const [x, y, z] = buy as [string, string, string];
    const { run } = await startOk(a, tripId, [x, y, z]);
    const shares = [a.id];
    expect((await finish(a, tripId, run!.id, { amountAgorot: 100, shares })).status).toBe(409);

    for (const id of [x, y, z]) await cart(a, tripId, id);
    // y bought on its own, z deleted.
    await client.trips[':tripId'].expenses.$post(
      { param: { tripId }, json: { description: 'y', amountAgorot: 100, shares, itemId: y } },
      as(a),
    );
    await client.trips[':tripId'].items[':itemId'].$delete({ param: { tripId, itemId: z } }, as(a));

    const res = await finish(a, tripId, run!.id, { amountAgorot: 500, shares });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ itemIds: [x], description: 'קניות · פריט אחד' });
  });

  it('validates the amount and the shares', async () => {
    const { a, tripId, buy } = await trip();
    const stranger = await signInAsGuest(app, 'stranger');
    const { run } = await startOk(a, tripId, [buy[0]!]);
    await cart(a, tripId, buy[0]!);
    const id = run!.id;
    expect((await finish(a, tripId, id, { amountAgorot: 0, shares: [a.id] })).status).toBe(400);
    expect((await finish(a, tripId, id, { amountAgorot: 10_000_001, shares: [a.id] })).status).toBe(
      400,
    );
    expect((await finish(a, tripId, id, { amountAgorot: 100, shares: [] })).status).toBe(400);
    expect(
      (await finish(a, tripId, id, { amountAgorot: 100, shares: [a.id, stranger.id] })).status,
    ).toBe(400);
    expect((await finish(a, tripId, id, { amountAgorot: 10_000_000, shares: [a.id] })).status).toBe(
      201,
    );
  });

  it('cancels, releasing every item', async () => {
    const { a, b, tripId, buy } = await trip();
    const { run } = await startOk(a, tripId, buy);
    await cart(a, tripId, buy[0]!);
    expect((await cancel(a, tripId, run!.id)).status).toBe(200);

    const after = await detail(b, tripId);
    expect(after.runs).toEqual([]);
    expect(after.claims.filter((cl) => buy.includes(cl.itemId))).toEqual([]);
    expect(after.expenses).toEqual([]);
    expect((await cart(a, tripId, buy[0]!)).status).toBe(409);
    expect((await cancel(a, tripId, run!.id)).status).toBe(409);
  });

  it('lets only the shopper act on their run', async () => {
    const { a, b, tripId, buy } = await trip();
    const stranger = await signInAsGuest(app, 'stranger');
    const { run } = await startOk(a, tripId, [buy[0]!]);
    const id = run!.id;
    const add = (user: Guest) =>
      runs()[':runId'].items.$post(
        { param: { tripId, runId: id }, json: { itemId: buy[1]! } },
        as(user),
      );

    expect((await add(b)).status).toBe(403);
    expect((await cart(b, tripId, buy[0]!)).status).toBe(409);
    expect((await finish(b, tripId, id, { amountAgorot: 100, shares: [b.id] })).status).toBe(403);
    expect((await cancel(b, tripId, id)).status).toBe(403);
    expect((await cancel(stranger, tripId, id)).status).toBe(404);
    expect((await start(stranger, tripId, buy)).status).toBe(404);

    expect((await add(a)).status).toBe(200);
    expect((await add(a)).status).toBe(409);
    expect((await detail(a, tripId)).claims.filter((cl) => cl.runId === id)).toHaveLength(2);
  });

  it('cancels the run of a removed member, so their items return to the list', async () => {
    const { a, b, tripId, buy } = await trip();
    await startOk(b, tripId, buy);
    const res = await client.trips[':tripId'].members[':userId'].$delete(
      { param: { tripId, userId: b.id } },
      as(a),
    );
    expect(res.status).toBe(200);
    const after = await detail(a, tripId);
    expect(after.runs).toEqual([]);
    expect(after.claims).toEqual([]);
    const [{ status }] = await sql<[{ status: string }]>`
      select status from shopping_runs where shopper_id = ${b.id}`;
    expect(status).toBe('cancelled');
  });

  it('allows one active run per shopper and trip in the database too', async () => {
    const { a, tripId, buy } = await trip();
    await startOk(a, tripId, [buy[0]!]);
    await expect(
      sql`insert into shopping_runs (trip_id, shopper_id, status, active)
        values (${tripId}, ${a.id}, 'active', true)`,
    ).rejects.toMatchObject({ code: '23505' });
    // Finished runs don't count.
    await sql`insert into shopping_runs (trip_id, shopper_id, status) values (${tripId}, ${a.id}, 'done')`;
    await sql`insert into shopping_runs (trip_id, shopper_id, status) values (${tripId}, ${a.id}, 'done')`;
  });

  it('unmarks the items when the run expense is deleted', async () => {
    const { a, tripId, buy } = await trip();
    const { run } = await startOk(a, tripId, [buy[0]!]);
    await cart(a, tripId, buy[0]!);
    const expense = await (
      await finish(a, tripId, run!.id, { amountAgorot: 100, shares: [a.id] })
    ).json();
    const res = await client.trips[':tripId'].expenses[':expenseId'].$delete(
      { param: { tripId, expenseId: expense.id } },
      as(a),
    );
    expect(res.status).toBe(204);
    const [{ count }] = await sql<[{ count: number }]>`
      select count(*)::int as count from expense_items where item_id = ${buy[0]!}`;
    expect(count).toBe(0);
  });
});
