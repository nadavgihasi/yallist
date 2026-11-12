import { testClient } from 'hono/testing';
import type { Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb } from '../db/client';
import { migrate } from '../db/migrate';
import { createTestDatabase, DATABASE_URL, signInAsGuest, testApp } from '../test-db';

describe.skipIf(!DATABASE_URL)('assigning an item to another member', () => {
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

  /** A camp trip that `a` organizes, with plain members `b` and `c`. */
  async function trip() {
    const [a, b, c] = await Promise.all(['a', 'b', 'c'].map((n) => signInAsGuest(app, n)));
    const res = await client.trips.$post(
      { json: { name: 'צפון', startsOn: '2026-11-05', endsOn: '2026-11-07', template: 'camp' } },
      as(a!),
    );
    const data = await res.json();
    for (const user of [b!, c!]) {
      const joined = await client.invites[':token'].join.$post(
        { param: { token: data.inviteToken }, json: {} },
        as(user),
      );
      expect(joined.status).toBe(200);
    }
    const ofKind = (kind: string) => data.items.find((i) => i.kind === kind)!;
    return {
      a: a!,
      b: b!,
      c: c!,
      tripId: data.trip.id,
      single: ofKind('single'),
      qty: ofKind('qty'),
      each: ofKind('each'),
    };
  }

  const claim = (
    user: Guest,
    tripId: string,
    itemId: string,
    json: { quantity: number; userId?: string; from?: string },
  ) =>
    client.trips[':tripId'].items[':itemId'].claim.$put(
      { param: { tripId, itemId }, json },
      as(user),
    );
  const claimsOf = async (user: Guest, tripId: string, itemId: string) => {
    const res = await client.trips[':tripId'].$get({ param: { tripId } }, as(user));
    return (await res.json()).claims.filter((cl) => cl.itemId === itemId);
  };
  const claimLog = (tripId: string) =>
    sql<{ actor: string; payload: Record<string, unknown> }[]>`
      select actor, payload from activity where trip_id = ${tripId} and type = 'claim_set'
      order by created_at`;

  it('lets a plain member assign an item to another, who has it as their own', async () => {
    const { a, b, c, tripId, single } = await trip();
    const res = await claim(b, tripId, single.id, { quantity: 1, userId: c.id });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ itemId: single.id, userId: c.id, quantity: 1 });

    // Everyone sees it as c's, and who assigned it.
    for (const viewer of [a, b, c]) {
      expect(await claimsOf(viewer, tripId, single.id)).toEqual([
        {
          itemId: single.id,
          userId: c.id,
          quantity: 1,
          arrived: false,
          packed: false,
          assignedBy: b.id,
        },
      ]);
    }
    expect(await claimLog(tripId)).toEqual([
      { actor: b.id, payload: { itemId: single.id, quantity: 1, userId: c.id } },
    ]);

    // c's like any claim of their own: they pack it, then release it.
    const packed = await client.trips[':tripId'].items[':itemId'].packed.$put(
      { param: { tripId, itemId: single.id }, json: { packed: true } },
      as(c),
    );
    expect(packed.status).toBe(200);
    expect((await claim(c, tripId, single.id, { quantity: 0 })).status).toBe(200);
    expect(await claimsOf(a, tripId, single.id)).toEqual([]);
  });

  it('keeps a self-claim unmarked, and the record when the assignee changes theirs', async () => {
    const { a, b, tripId, single, qty } = await trip();
    await claim(a, tripId, single.id, { quantity: 1, userId: a.id });
    expect((await claimsOf(a, tripId, single.id))[0]).not.toHaveProperty('assignedBy');

    await claim(a, tripId, qty.id, { quantity: 1, userId: b.id });
    await claim(b, tripId, qty.id, { quantity: 2 });
    expect(await claimsOf(a, tripId, qty.id)).toMatchObject([
      { userId: b.id, quantity: 2, assignedBy: a.id },
    ]);
  });

  it('reassigns a single item from its holder, and unassigns it', async () => {
    const { a, b, c, tripId, single } = await trip();
    await claim(b, tripId, single.id, { quantity: 1 });

    // Without `from`, someone else has it already: the usual conflict.
    const taken = await claim(a, tripId, single.id, { quantity: 1, userId: c.id });
    expect(taken.status).toBe(409);
    expect(await taken.json()).toEqual({ error: 'At most 0 can be claimed' });

    const moved = await claim(a, tripId, single.id, { quantity: 1, userId: c.id, from: b.id });
    expect(moved.status).toBe(200);
    expect(await claimsOf(a, tripId, single.id)).toMatchObject([
      { userId: c.id, quantity: 1, assignedBy: a.id },
    ]);
    expect((await claimLog(tripId)).at(-1)).toEqual({
      actor: a.id,
      payload: { itemId: single.id, quantity: 1, userId: c.id, from: b.id },
    });

    // Back to the organizer themselves, then off them: nobody has it.
    expect(
      (await claim(b, tripId, single.id, { quantity: 1, userId: a.id, from: c.id })).status,
    ).toBe(200);
    expect(await claimsOf(a, tripId, single.id)).toMatchObject([
      { userId: a.id, assignedBy: b.id },
    ]);
    expect((await claim(b, tripId, single.id, { quantity: 0, userId: a.id })).status).toBe(200);
    expect(await claimsOf(a, tripId, single.id)).toEqual([]);
  });

  it('caps a qty item at what is still needed', async () => {
    const { a, b, c, tripId, qty } = await trip();
    const needed = qty.quantityNeeded;
    expect((await claim(a, tripId, qty.id, { quantity: needed - 1, userId: b.id })).status).toBe(
      200,
    );
    const over = await claim(a, tripId, qty.id, { quantity: 2, userId: c.id });
    expect(over.status).toBe(409);
    expect(await over.json()).toEqual({ error: 'At most 1 can be claimed' });
    expect((await claim(a, tripId, qty.id, { quantity: 1, userId: c.id })).status).toBe(200);
    expect(await claimsOf(a, tripId, qty.id)).toMatchObject([
      { userId: b.id, quantity: needed - 1 },
      { userId: c.id, quantity: 1 },
    ]);
  });

  it("doesn't assign a per-person item: everyone brings their own", async () => {
    const { a, b, tripId, each } = await trip();
    const res = await claim(a, tripId, each.id, { quantity: 1, userId: b.id });
    expect(res.status).toBe(400);
    expect(await claimsOf(a, tripId, each.id)).toEqual([]);
  });

  it('assigns only to active members, and only by them', async () => {
    const { a, b, c, tripId, single } = await trip();
    const stranger = await signInAsGuest(app, 'stranger');
    expect((await claim(a, tripId, single.id, { quantity: 1, userId: stranger.id })).status).toBe(
      404,
    );
    expect((await claim(stranger, tripId, single.id, { quantity: 1, userId: b.id })).status).toBe(
      404,
    );

    const removed = await client.trips[':tripId'].members[':userId'].$delete(
      { param: { tripId, userId: c.id } },
      as(a),
    );
    expect(removed.status).toBe(200);
    const res = await claim(b, tripId, single.id, { quantity: 1, userId: c.id });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Member not found' });
    // A removed member can't assign either.
    expect((await claim(c, tripId, single.id, { quantity: 1, userId: b.id })).status).toBe(404);
    expect(await claimsOf(a, tripId, single.id)).toEqual([]);
  });

  it('lets only one of two racing assignments take the item', async () => {
    const { a, b, c, tripId, single } = await trip();
    const results = await Promise.all([
      claim(a, tripId, single.id, { quantity: 1, userId: b.id }),
      claim(b, tripId, single.id, { quantity: 1, userId: c.id }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await claimsOf(a, tripId, single.id)).toHaveLength(1);

    // Two reassignments from the same holder: the second finds it moved already.
    const holder = (await claimsOf(a, tripId, single.id))[0]!.userId;
    const [to1, to2] = [a.id, b.id, c.id].filter((id) => id !== holder) as [string, string];
    const moves = await Promise.all([
      claim(a, tripId, single.id, { quantity: 1, userId: to1, from: holder }),
      claim(b, tripId, single.id, { quantity: 1, userId: to2, from: holder }),
    ]);
    expect(moves.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await moves.find((r) => r.status === 409)!.json()).toEqual({
      error: 'At most 0 can be claimed',
    });
    expect(await claimsOf(a, tripId, single.id)).toHaveLength(1);
  });

  it('lets two members assign to each other at once', async () => {
    const { a, b, tripId, qty } = await trip();
    // Each locks both memberships: in one order, or they deadlock.
    for (let round = 0; round < 5; round++) {
      const results = await Promise.all([
        claim(a, tripId, qty.id, { quantity: 1, userId: b.id }),
        claim(b, tripId, qty.id, { quantity: 1, userId: a.id }),
      ]);
      expect(results.map((r) => r.status)).toEqual([200, 200]);
    }
  });

  it("leaves a claim in someone else's shopping run alone", async () => {
    const { a, b, c, tripId } = await trip();
    const items = (await (await client.trips[':tripId'].$get({ param: { tripId } }, as(a))).json())
      .items;
    const buy = items.find((i) => i.list === 'buy' && i.kind === 'single')!;
    const run = await client.trips[':tripId'].runs.$post(
      { param: { tripId }, json: { itemIds: [buy.id] } },
      as(b),
    );
    expect(run.status).toBe(200);

    expect((await claim(a, tripId, buy.id, { quantity: 1, userId: c.id, from: b.id })).status).toBe(
      409,
    );
    expect((await claim(a, tripId, buy.id, { quantity: 0, userId: b.id })).status).toBe(409);
    expect(await claimsOf(a, tripId, buy.id)).toMatchObject([{ userId: b.id }]);
  });

  it('leaves who has a bought item alone', async () => {
    const { a, b, c, tripId } = await trip();
    const items = (await (await client.trips[':tripId'].$get({ param: { tripId } }, as(a))).json())
      .items;
    const buy = items.find((i) => i.list === 'buy' && i.kind === 'single')!;
    await claim(b, tripId, buy.id, { quantity: 1 });
    const bought = await client.trips[':tripId'].expenses.$post(
      {
        param: { tripId },
        json: { description: 'x', amountAgorot: 100, shares: [b.id], itemId: buy.id },
      },
      as(b),
    );
    expect(bought.status).toBe(201);

    for (const json of [
      { quantity: 1, userId: c.id, from: b.id },
      { quantity: 0, userId: b.id },
      { quantity: 1, from: b.id },
    ]) {
      const res = await claim(a, tripId, buy.id, json);
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'Already bought' });
    }
    expect(await claimsOf(a, tripId, buy.id)).toMatchObject([{ userId: b.id }]);
  });
});
