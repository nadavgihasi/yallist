import { splitEqually } from '@yallist/domain';
import { testClient } from 'hono/testing';
import type { Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb } from '../db/client';
import { migrate } from '../db/migrate';
import { createTestDatabase, DATABASE_URL, signInAsGuest, testApp } from '../test-db';

describe.skipIf(!DATABASE_URL)('expenses and payments', () => {
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

  /** A grill trip with three active members; `a` organizes. */
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
    return {
      a: a!,
      b: b!,
      c: c!,
      tripId: data.trip.id,
      items: data.items,
      inviteToken: data.inviteToken,
    };
  }

  const addExpense = (
    user: Guest,
    tripId: string,
    json: {
      amountAgorot: number;
      shares: string[];
      paidBy?: string;
      itemId?: string;
      parts?: { label: string; amountAgorot: number; shares: string[] }[];
      weights?: Record<string, number>;
      spentOn?: string;
    },
  ) =>
    client.trips[':tripId'].expenses.$post(
      { param: { tripId }, json: { description: 'פחמים', ...json } },
      as(user),
    );
  const detail = async (user: Guest, tripId: string) =>
    (await client.trips[':tripId'].$get({ param: { tripId } }, as(user))).json();
  const pay = (user: Guest, tripId: string, toUser: string, amountAgorot: number) =>
    client.trips[':tripId'].payments.$post(
      { param: { tripId }, json: { toUser, amountAgorot } },
      as(user),
    );
  /** `user` records that `fromUser` paid `toUser`. */
  const record = (
    user: Guest,
    tripId: string,
    fromUser: string,
    toUser: string,
    amountAgorot: number,
  ) =>
    client.trips[':tripId'].payments.$post(
      { param: { tripId }, json: { fromUser, toUser, amountAgorot } },
      as(user),
    );

  it('splits an expense equally, giving the remainder by user id', async () => {
    const { a, b, c, tripId } = await trip();
    const res = await addExpense(b, tripId, { amountAgorot: 1000, shares: [a.id, b.id, c.id] });
    expect(res.status).toBe(201);

    const owed = splitEqually(1000, [a.id, b.id, c.id]);
    expect([...owed.values()].sort()).toEqual([333, 333, 334]);
    const { balances, transfers } = await detail(a, tripId);
    expect(balances).toEqual({
      [a.id]: -owed.get(a.id)!,
      [b.id]: 1000 - owed.get(b.id)!,
      [c.id]: -owed.get(c.id)!,
    });
    expect(transfers).toEqual(
      expect.arrayContaining([
        { from: a.id, to: b.id, amountAgorot: owed.get(a.id) },
        { from: c.id, to: b.id, amountAgorot: owed.get(c.id) },
      ]),
    );
  });

  it('leaves members out of expenses they are not part of', async () => {
    const { a, b, c, tripId } = await trip();
    await addExpense(a, tripId, { amountAgorot: 900, shares: [a.id, b.id] });
    const { balances, transfers } = await detail(c, tripId);
    expect(balances).toEqual({ [a.id]: 450, [b.id]: -450, [c.id]: 0 });
    expect(transfers).toEqual([{ from: b.id, to: a.id, amountAgorot: 450 }]);

    const home = await (await client.trips.$get({}, as(c))).json();
    expect(home.trips[0]!.transfers).toEqual([]);
  });

  it('validates amounts, payers and shares', async () => {
    const { a, b, tripId } = await trip();
    const stranger = await signInAsGuest(app, 'stranger');
    expect((await addExpense(a, tripId, { amountAgorot: 0, shares: [a.id] })).status).toBe(400);
    expect((await addExpense(a, tripId, { amountAgorot: 100, shares: [] })).status).toBe(400);
    expect(
      (await addExpense(a, tripId, { amountAgorot: 100, shares: [a.id, stranger.id] })).status,
    ).toBe(400);
    expect(
      (await addExpense(a, tripId, { amountAgorot: 100, shares: [a.id], paidBy: stranger.id }))
        .status,
    ).toBe(400);
    expect((await addExpense(stranger, tripId, { amountAgorot: 100, shares: [b.id] })).status).toBe(
      404,
    );
  });

  it('marks a linked buy item as bought, once', async () => {
    const { a, b, tripId, items } = await trip();
    const buy = items.find((i) => i.list === 'buy')!;
    const bring = items.find((i) => i.list === 'bring')!;

    expect(
      (await addExpense(a, tripId, { amountAgorot: 100, shares: [a.id], itemId: bring.id })).status,
    ).toBe(400);
    const res = await addExpense(a, tripId, {
      amountAgorot: 4500,
      shares: [a.id, b.id],
      itemId: buy.id,
    });
    expect(await res.json()).toMatchObject({ itemIds: [buy.id], paidBy: a.id });
    expect(
      (await addExpense(b, tripId, { amountAgorot: 100, shares: [b.id], itemId: buy.id })).status,
    ).toBe(409);

    const home = await (await client.trips.$get({}, as(a))).json();
    expect(home.trips[0]!.doneCount).toBe(1);
  });

  it('records a single-item purchase in expense_items, not expenses.item_id', async () => {
    const { a, tripId, items } = await trip();
    const buy = items.find((i) => i.list === 'buy')!;

    const res = await addExpense(a, tripId, { amountAgorot: 100, shares: [a.id], itemId: buy.id });
    const expense = await res.json();
    expect(expense).toMatchObject({ itemIds: [buy.id] });
    expect(await sql`select item_id from expenses where id = ${expense.id}`).toEqual([
      { item_id: null },
    ]);
    expect(await sql`select item_id from expense_items where expense_id = ${expense.id}`).toEqual([
      { item_id: buy.id },
    ]);
    // Bought, as everyone loading the trip sees it.
    const seen = await detail(a, tripId);
    expect(seen.expenses.find((e) => e.id === expense.id)?.itemIds).toEqual([buy.id]);
  });

  it('deletes an expense for whoever added or paid it, or an organizer', async () => {
    const { a, b, c, tripId } = await trip();
    const expense = await (
      await addExpense(b, tripId, { amountAgorot: 600, shares: [a.id, b.id, c.id], paidBy: c.id })
    ).json();
    const del = (user: Guest) =>
      client.trips[':tripId'].expenses[':expenseId'].$delete(
        { param: { tripId, expenseId: expense.id } },
        as(user),
      );

    const other = await (await addExpense(a, tripId, { amountAgorot: 100, shares: [a.id] })).json();
    const delOther = (user: Guest) =>
      client.trips[':tripId'].expenses[':expenseId'].$delete(
        { param: { tripId, expenseId: other.id } },
        as(user),
      );
    expect((await delOther(b)).status).toBe(403);
    expect((await delOther(a)).status).toBe(204);

    expect((await del(c)).status).toBe(204);
    expect((await del(c)).status).toBe(404);
    expect((await detail(a, tripId)).expenses).toEqual([]);
    const types = await sql<{ type: string }[]>`
      select type from activity where trip_id = ${tripId} and type like 'expense_%'`;
    expect(types.map((t) => t.type).sort()).toEqual([
      'expense_added',
      'expense_added',
      'expense_deleted',
      'expense_deleted',
    ]);
  });

  const edit = (
    user: Guest,
    tripId: string,
    expenseId: string,
    json: {
      description?: string;
      amountAgorot?: number;
      paidBy?: string;
      shares?: string[];
      parts?: { label: string; amountAgorot: number; shares: string[] }[];
      weights?: Record<string, number>;
      spentOn?: string;
    },
  ) =>
    client.trips[':tripId'].expenses[':expenseId'].$patch(
      { param: { tripId, expenseId }, json },
      as(user),
    );

  it('edits an expense in place, and balances follow', async () => {
    const { a, b, c, tripId } = await trip();
    const expense = await (
      await addExpense(b, tripId, { amountAgorot: 900, shares: [a.id, b.id, c.id] })
    ).json();
    expect(expense.createdBy).toBe(b.id);

    const res = await edit(b, tripId, expense.id, {
      description: 'קרח',
      amountAgorot: 1200,
      paidBy: c.id,
      shares: [a.id, c.id, a.id],
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: expense.id,
      description: 'קרח',
      amountAgorot: 1200,
      paidBy: c.id,
      createdBy: b.id,
      shares: expect.arrayContaining([a.id, c.id]),
    });
    const after = await detail(a, tripId);
    expect(after.expenses).toHaveLength(1);
    expect(after.expenses[0]!.shares).toHaveLength(2);
    expect(after.balances).toEqual({ [a.id]: -600, [b.id]: 0, [c.id]: 600 });
    expect(after.transfers).toEqual([{ from: a.id, to: c.id, amountAgorot: 600 }]);

    // Only what's given changes.
    await edit(a, tripId, expense.id, { description: 'קרח ופחמים' });
    expect((await detail(c, tripId)).expenses[0]).toMatchObject({
      description: 'קרח ופחמים',
      amountAgorot: 1200,
      paidBy: c.id,
    });

    const logged = await sql<{ payload: Record<string, unknown> }[]>`
      select payload from activity where trip_id = ${tripId} and type = 'expense_edited'
      order by created_at`;
    expect(logged.map((l) => l.payload)).toEqual([
      { expenseId: expense.id, fromAgorot: 900, amountAgorot: 1200 },
      { expenseId: expense.id, fromAgorot: 1200, amountAgorot: 1200 },
    ]);
  });

  it('keeps the receipt and the bought item through an edit', async () => {
    const { a, b, tripId, items } = await trip();
    const buy = items.find((i) => i.list === 'buy')!;
    const expense = await (
      await addExpense(a, tripId, { amountAgorot: 4500, shares: [a.id, b.id], itemId: buy.id })
    ).json();
    await sql`update expenses set receipt_path = 'r.jpg' where id = ${expense.id}`;

    expect((await edit(a, tripId, expense.id, { amountAgorot: 5000 })).status).toBe(200);
    const [after] = (await detail(b, tripId)).expenses;
    expect(after).toMatchObject({ amountAgorot: 5000, itemIds: [buy.id], hasReceipt: true });
    // Still bought: a second purchase of it is refused.
    expect(
      (await addExpense(b, tripId, { amountAgorot: 100, shares: [b.id], itemId: buy.id })).status,
    ).toBe(409);
  });

  it('lets only whoever may delete an expense edit it', async () => {
    const { a, b, c, tripId } = await trip();
    // Added by b, paid by c; a organizes.
    const expense = await (
      await addExpense(b, tripId, { amountAgorot: 600, shares: [a.id, b.id], paidBy: c.id })
    ).json();
    for (const user of [a, b, c]) {
      expect((await edit(user, tripId, expense.id, { amountAgorot: 700 })).status).toBe(200);
    }
    const mine = await (await addExpense(a, tripId, { amountAgorot: 100, shares: [a.id] })).json();
    expect((await edit(b, tripId, mine.id, { amountAgorot: 1 })).status).toBe(403);
    const stranger = await signInAsGuest(app, 'stranger');
    expect((await edit(stranger, tripId, mine.id, { amountAgorot: 1 })).status).toBe(404);
    expect((await detail(a, tripId)).expenses.find((e) => e.id === mine.id)!.amountAgorot).toBe(
      100,
    );
  });

  it('validates an edit as it validates a new expense', async () => {
    const { a, b, c, tripId } = await trip();
    const stranger = await signInAsGuest(app, 'stranger');
    const { id } = await (
      await addExpense(a, tripId, { amountAgorot: 1000, shares: [a.id, b.id] })
    ).json();
    expect((await edit(a, tripId, id, { amountAgorot: 0 })).status).toBe(400);
    expect((await edit(a, tripId, id, { description: ' ' })).status).toBe(400);
    expect((await edit(a, tripId, id, { shares: [] })).status).toBe(400);
    expect((await edit(a, tripId, id, { shares: [a.id, stranger.id] })).status).toBe(400);
    expect((await edit(a, tripId, id, { paidBy: stranger.id })).status).toBe(400);

    // Someone who left can keep their place on it, but isn't added to it.
    await addExpense(a, tripId, { amountAgorot: 100, shares: [c.id] });
    expect((await remove(a, tripId, b.id)).status).toBe(200);
    expect((await edit(a, tripId, id, { amountAgorot: 2000, shares: [a.id, b.id] })).status).toBe(
      200,
    );
    expect((await detail(a, tripId)).balances[b.id]).toBe(-1000);
  });

  it('keeps the day an expense was spent, when given one', async () => {
    const { a, b, tripId } = await trip();
    const today = await (await addExpense(a, tripId, { amountAgorot: 100, shares: [a.id] })).json();
    expect(today).not.toHaveProperty('spentOn');
    const res = await addExpense(a, tripId, {
      amountAgorot: 100,
      shares: [a.id, b.id],
      spentOn: '2026-11-17',
    });
    expect(res.status).toBe(201);
    const { id } = await res.json();
    expect((await detail(b, tripId)).expenses[1]).toMatchObject({ id, spentOn: '2026-11-17' });
    expect((await edit(a, tripId, id, { spentOn: '2026-11-16' })).status).toBe(200);
    expect((await detail(b, tripId)).expenses[1]!.spentOn).toBe('2026-11-16');
    expect(
      (await addExpense(a, tripId, { amountAgorot: 100, shares: [a.id], spentOn: '17.11' })).status,
    ).toBe(400);
    expect(
      (await addExpense(a, tripId, { amountAgorot: 100, shares: [a.id], spentOn: '1926-11-17' }))
        .status,
    ).toBe(400);
  });

  it('splits a new expense by weight', async () => {
    const { a, b, c, tripId } = await trip();
    // ₪300 by 2, 2, 1: ₪120, ₪120, ₪60.
    const res = await addExpense(a, tripId, {
      amountAgorot: 30000,
      shares: [a.id, b.id, c.id],
      weights: { [a.id]: 2, [b.id]: 2 },
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ weights: { [a.id]: 2, [b.id]: 2 } });
    const after = await detail(c, tripId);
    expect(after.expenses[0]!.weights).toEqual({ [a.id]: 2, [b.id]: 2 });
    expect(after.balances).toMatchObject({ [a.id]: 18000, [b.id]: -12000, [c.id]: -6000 });

    // Weights only for people who share it, and at most MAX_WEIGHT.
    const bad = (weights: Record<string, number>) =>
      addExpense(a, tripId, { amountAgorot: 100, shares: [a.id, b.id], weights }).then(
        (r) => r.status,
      );
    expect(await bad({ [c.id]: 2 })).toBe(400);
    // A weight of 1 is the default: not stored, and not echoed back either.
    const one = await addExpense(a, tripId, {
      amountAgorot: 100,
      shares: [a.id, b.id],
      weights: { [a.id]: 1 },
    });
    expect(await one.json()).not.toHaveProperty('weights');
    expect(await bad({ [a.id]: 11 })).toBe(400);
    expect(await bad({ [a.id]: 0 })).toBe(400);
  });

  it('splits a new expense in parts', async () => {
    const { a, b, c, tripId } = await trip();
    const wine = { label: 'יין', amountAgorot: 8000, shares: [a.id, b.id] };
    const res = await addExpense(a, tripId, {
      amountAgorot: 30000,
      shares: [a.id, b.id, c.id],
      parts: [wine],
    });
    expect(res.status).toBe(201);
    const after = await detail(c, tripId);
    expect(after.expenses[0]!.parts).toEqual([
      { ...wine, shares: expect.arrayContaining(wine.shares) },
    ]);
    // ₪40 + ⅓ of ₪220 each for a and b, ⅓ of ₪220 for c.
    // ₪220 doesn't divide by 3: one of them pays the extra agora.
    expect([-7333, -7334]).toContain(after.balances[c.id]);
    // Parts must leave something for the rest, and share between members only.
    const over = { ...wine, amountAgorot: 30000 };
    expect(
      (await addExpense(a, tripId, { amountAgorot: 30000, shares: [a.id], parts: [over] })).status,
    ).toBe(400);
    const stranger = await signInAsGuest(app, 'stranger');
    const outsider = { ...wine, shares: [stranger.id] };
    expect(
      (await addExpense(a, tripId, { amountAgorot: 30000, shares: [a.id], parts: [outsider] }))
        .status,
    ).toBe(400);
  });

  it('edits weights, and keeps them through other edits', async () => {
    const { a, b, c, tripId } = await trip();
    const { id } = await (
      await addExpense(a, tripId, { amountAgorot: 30000, shares: [a.id, b.id, c.id] })
    ).json();
    expect((await edit(a, tripId, id, { weights: { [c.id]: 2 } })).status).toBe(200);
    expect((await detail(a, tripId)).balances[c.id]).toBe(-15000);
    // An amount-only edit keeps them.
    expect((await edit(a, tripId, id, { amountAgorot: 40000 })).status).toBe(200);
    expect((await detail(a, tripId)).expenses[0]!.weights).toEqual({ [c.id]: 2 });
    // Dropping c from the shares drops c's weight.
    expect((await edit(a, tripId, id, { shares: [a.id, b.id] })).status).toBe(200);
    expect((await detail(a, tripId)).expenses[0]!.weights).toBeUndefined();
    expect((await edit(a, tripId, id, { weights: { [c.id]: 2 } })).status).toBe(400);
  });

  it('edits the parts, and refuses parts that no longer fit under the total', async () => {
    const { a, b, c, tripId } = await trip();
    const { id } = await (
      await addExpense(a, tripId, { amountAgorot: 1000, shares: [a.id, b.id, c.id] })
    ).json();
    const parts = [{ label: 'אלכוהול', amountAgorot: 400, shares: [a.id, b.id] }];
    expect((await edit(a, tripId, id, { parts })).status).toBe(200);
    // 400 between a and b, the 600 left between all three.
    expect((await detail(a, tripId)).balances).toEqual({
      [a.id]: 1000 - 400,
      [b.id]: -400,
      [c.id]: -200,
    });

    expect((await edit(a, tripId, id, { amountAgorot: 400 })).status).toBe(400);
    expect(
      (await edit(a, tripId, id, { parts: [{ ...parts[0]!, amountAgorot: 1000 }] })).status,
    ).toBe(400);
    const [kept] = (await detail(a, tripId)).expenses;
    expect(kept!.amountAgorot).toBe(1000);
    expect(kept!.parts).toEqual([
      { ...parts[0], shares: expect.arrayContaining(parts[0]!.shares) },
    ]);

    // An empty list drops the parts.
    expect((await edit(a, tripId, id, { amountAgorot: 400, parts: [] })).status).toBe(200);
    const [after] = (await detail(a, tripId)).expenses;
    expect(after!.parts).toBeUndefined();
    expect(after!.amountAgorot).toBe(400);
  });

  it('records payments that count at once, for anyone in the trip', async () => {
    const { a, b, c, tripId } = await trip();
    await addExpense(a, tripId, { amountAgorot: 900, shares: [a.id, b.id, c.id] });
    expect((await pay(b, tripId, b.id, 300)).status).toBe(400);
    const stranger = await signInAsGuest(app, 'stranger');
    expect((await pay(stranger, tripId, a.id, 300)).status).toBe(404);
    expect((await record(a, tripId, b.id, stranger.id, 300)).status).toBe(400);

    const res = await pay(b, tripId, a.id, 300);
    expect(res.status).toBe(201);
    const payment = await res.json();
    expect(payment).toEqual({
      id: expect.any(String),
      fromUser: b.id,
      toUser: a.id,
      amountAgorot: 300,
      createdBy: b.id,
      createdAt: expect.any(String),
    });
    // It counts at once: what's left to settle shrinks, with nobody confirming it.
    expect((await detail(a, tripId)).transfers).toEqual([
      { from: c.id, to: a.id, amountAgorot: 300 },
    ]);
    expect((await detail(c, tripId)).payments).toEqual([payment]);

    // Someone else records that c paid a.
    const third = await (await record(b, tripId, c.id, a.id, 300)).json();
    expect(third).toMatchObject({ fromUser: c.id, toUser: a.id, createdBy: b.id });
    expect((await detail(a, tripId)).transfers).toEqual([]);
  });

  it('still answers older apps that confirm a payment', async () => {
    const { a, b, tripId } = await trip();
    await addExpense(a, tripId, { amountAgorot: 900, shares: [a.id, b.id] });
    const payment = await (await pay(b, tripId, a.id, 300)).json();
    const confirm = client.trips[':tripId'].payments[':paymentId'].confirm.$post;
    const res = await confirm({ param: { tripId, paymentId: payment.id } }, as(a));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: payment.id, status: 'confirmed' });
    const stranger = await signInAsGuest(app, 'stranger');
    expect((await confirm({ param: { tripId, paymentId: payment.id } }, as(stranger))).status).toBe(
      404,
    );
  });

  it('deletes a payment for whoever recorded it, its payer or receiver, or an organizer', async () => {
    const { a, b, c, tripId, inviteToken } = await trip();
    const d = await signInAsGuest(app, 'd');
    await client.invites[':token'].join.$post({ param: { token: inviteToken }, json: {} }, as(d));
    await addExpense(a, tripId, { amountAgorot: 900, shares: [a.id, b.id, c.id] });
    const paymentOf = (user: Guest) => record(user, tripId, b.id, a.id, 100).then((r) => r.json());
    const del = (user: Guest, paymentId: string) =>
      client.trips[':tripId'].payments[':paymentId'].$delete(
        { param: { tripId, paymentId } },
        as(user),
      );

    // c recorded it: c, b (the payer), a (the receiver, also the organizer) may delete; d may not.
    const p1 = await paymentOf(c);
    expect((await del(d, p1.id)).status).toBe(403);
    expect((await del(c, p1.id)).status).toBe(204);
    const p2 = await paymentOf(c);
    expect((await del(b, p2.id)).status).toBe(204);
    const p3 = await paymentOf(d);
    expect((await del(a, p3.id)).status).toBe(204);
    expect((await detail(a, tripId)).payments).toEqual([]);
    expect((await del(a, p3.id)).status).toBe(404);
  });

  const remove = (organizer: Guest, tripId: string, userId: string) =>
    client.trips[':tripId'].members[':userId'].$delete(
      { param: { tripId, userId } },
      as(organizer),
    );

  it('pays a removed member back', async () => {
    const { a, b, c, tripId } = await trip();
    await addExpense(c, tripId, { amountAgorot: 900, shares: [a.id, b.id, c.id] });
    expect((await remove(a, tripId, c.id)).status).toBe(200);
    // Still owed after leaving.
    expect((await detail(a, tripId)).balances[c.id]).toBe(600);

    const res = await pay(a, tripId, c.id, 300);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ fromUser: a.id, toUser: c.id });
    const after = await detail(b, tripId);
    expect(after.balances[c.id]).toBe(300);
    expect(after.transfers).toEqual([{ from: b.id, to: c.id, amountAgorot: 300 }]);
  });

  it('records a removed member paying, by anyone still in the trip', async () => {
    const { a, b, c, tripId } = await trip();
    await addExpense(a, tripId, { amountAgorot: 900, shares: [a.id, b.id, c.id] });
    await remove(a, tripId, c.id);
    // They can't record it themselves.
    expect((await pay(c, tripId, a.id, 300)).status).toBe(404);

    const res = await record(b, tripId, c.id, a.id, 300);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ fromUser: c.id, toUser: a.id, createdBy: b.id });
    const after = await detail(b, tripId);
    expect(after.balances[c.id]).toBe(0);
    expect(after.transfers).toEqual([{ from: b.id, to: a.id, amountAgorot: 300 }]);
  });

  const setPhone = (user: Guest, paymentPhone: string) =>
    app.request('/me', {
      method: 'PATCH',
      headers: { ...user.headers, 'content-type': 'application/json' },
      body: JSON.stringify({ paymentPhone }),
    });

  it("shows active members' payment phones to their trip-mates only", async () => {
    const { a, b, c, tripId } = await trip();
    expect((await setPhone(a, '050-123 4567')).status).toBe(200);
    expect((await setPhone(c, '052-765 4321')).status).toBe(200);
    const phoneOf = (data: { members: { userId: string; paymentPhone?: string }[] }, id: string) =>
      data.members.find((m) => m.userId === id)?.paymentPhone;

    const data = await detail(b, tripId);
    expect(phoneOf(data, a.id)).toBe('+972501234567');
    expect(phoneOf(data, b.id)).toBeUndefined();
    expect(phoneOf(data, c.id)).toBe('+972527654321');

    // Not on the home screen's cards, nor in the public invite preview.
    const home = await (await client.trips.$get({}, as(b))).json();
    expect(JSON.stringify(home)).not.toContain('+9725');
    const preview = await client.invites[':token'].$get({ param: { token: data.inviteToken } });
    expect(JSON.stringify(await preview.json())).not.toContain('+9725');
    // Someone outside the trip doesn't get the trip at all.
    const stranger = await signInAsGuest(app, 'stranger');
    expect((await client.trips[':tripId'].$get({ param: { tripId } }, as(stranger))).status).toBe(
      404,
    );

    // A member who left keeps their number to themselves.
    await remove(a, tripId, c.id);
    expect(phoneOf(await detail(b, tripId), c.id)).toBeUndefined();
  });

  it('lowers what is left to pay by a partial payment', async () => {
    const { a, b, c, tripId } = await trip();
    await addExpense(a, tripId, { amountAgorot: 900, shares: [a.id, b.id, c.id] });
    expect((await pay(b, tripId, a.id, 100)).status).toBe(201);
    expect((await detail(b, tripId)).transfers).toEqual(
      expect.arrayContaining([
        { from: b.id, to: a.id, amountAgorot: 200 },
        { from: c.id, to: a.id, amountAgorot: 300 },
      ]),
    );
  });

  it('rejects payments with someone who was never a member', async () => {
    const { a, tripId } = await trip();
    const stranger = await signInAsGuest(app, 'stranger');
    expect((await pay(a, tripId, stranger.id, 300)).status).toBe(400);
    expect((await record(a, tripId, stranger.id, a.id, 300)).status).toBe(400);
  });
});
