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
    return { a: a!, b: b!, c: c!, tripId: data.trip.id, items: data.items };
  }

  const addExpense = (
    user: Guest,
    tripId: string,
    json: { amountAgorot: number; shares: string[]; paidBy?: string; itemId?: string },
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

  it('records payments, confirmed by the receiver and deletable until then', async () => {
    const { a, b, c, tripId } = await trip();
    await addExpense(a, tripId, { amountAgorot: 900, shares: [a.id, b.id, c.id] });
    expect((await pay(b, tripId, b.id, 300)).status).toBe(400);
    const stranger = await signInAsGuest(app, 'stranger');
    expect((await pay(stranger, tripId, a.id, 300)).status).toBe(404);

    const res = await pay(b, tripId, a.id, 300);
    expect(res.status).toBe(201);
    const payment = await res.json();
    expect(payment).toMatchObject({ fromUser: b.id, toUser: a.id, status: 'marked' });
    // Recorded payments shrink what's left to settle.
    expect((await detail(a, tripId)).transfers).toEqual([
      { from: c.id, to: a.id, amountAgorot: 300 },
    ]);

    const param = { param: { tripId, paymentId: payment.id } };
    const payments = client.trips[':tripId'].payments[':paymentId'];
    expect((await payments.confirm.$post(param, as(b))).status).toBe(403);
    expect((await payments.$delete(param, as(a))).status).toBe(403);
    expect((await payments.confirm.$post(param, as(a))).status).toBe(200);
    expect((await payments.$delete(param, as(b))).status).toBe(409);
    expect((await detail(c, tripId)).payments).toEqual([{ ...payment, status: 'confirmed' }]);

    const second = await (await pay(c, tripId, a.id, 300)).json();
    const secondParam = { param: { tripId, paymentId: second.id } };
    expect((await payments.$delete(secondParam, as(c))).status).toBe(204);
    expect((await detail(c, tripId)).payments).toHaveLength(1);
  });

  const remove = (organizer: Guest, tripId: string, userId: string) =>
    client.trips[':tripId'].members[':userId'].$delete(
      { param: { tripId, userId } },
      as(organizer),
    );
  const receive = (user: Guest, tripId: string, fromUser: string, amountAgorot: number) =>
    client.trips[':tripId'].payments.$post(
      { param: { tripId }, json: { fromUser, toUser: user.id, amountAgorot } },
      as(user),
    );

  it('pays a removed member back', async () => {
    const { a, b, c, tripId } = await trip();
    await addExpense(c, tripId, { amountAgorot: 900, shares: [a.id, b.id, c.id] });
    expect((await remove(a, tripId, c.id)).status).toBe(200);
    // Still owed after leaving.
    expect((await detail(a, tripId)).balances[c.id]).toBe(600);

    const res = await pay(a, tripId, c.id, 300);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ fromUser: a.id, toUser: c.id, status: 'marked' });
    const after = await detail(b, tripId);
    expect(after.balances[c.id]).toBe(300);
    expect(after.transfers).toEqual([{ from: b.id, to: c.id, amountAgorot: 300 }]);
  });

  it('records a removed member paying, by the receiver, already confirmed', async () => {
    const { a, b, c, tripId } = await trip();
    await addExpense(a, tripId, { amountAgorot: 900, shares: [a.id, b.id, c.id] });
    await remove(a, tripId, c.id);
    expect((await pay(c, tripId, a.id, 300)).status).toBe(404);
    // Only the receiver records it, and only for someone who left.
    const thirdParty = client.trips[':tripId'].payments.$post(
      { param: { tripId }, json: { fromUser: c.id, toUser: a.id, amountAgorot: 300 } },
      as(b),
    );
    expect((await thirdParty).status).toBe(400);
    expect((await receive(a, tripId, b.id, 300)).status).toBe(400);

    const res = await receive(a, tripId, c.id, 300);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ fromUser: c.id, toUser: a.id, status: 'confirmed' });
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
    expect((await receive(a, tripId, stranger.id, 300)).status).toBe(400);
  });
});
