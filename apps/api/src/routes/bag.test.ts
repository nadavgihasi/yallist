import { testClient } from 'hono/testing';
import type { Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb } from '../db/client';
import { migrate } from '../db/migrate';
import { createTestDatabase, DATABASE_URL, signInAsGuest, testApp } from '../test-db';

// Private items (packing spec §2–§4, step 2): only their owner can see or change them, through
// any route, and they count towards nothing.
describe.skipIf(!DATABASE_URL)('my bag: private items', () => {
  let sql: Sql;
  let drop: () => Promise<void>;
  let app: ReturnType<typeof testApp>;
  let client: ReturnType<typeof testClient<ReturnType<typeof testApp>>>;
  const published: string[] = [];

  beforeAll(async () => {
    ({ sql, drop } = await createTestDatabase());
    await migrate(sql, { dsql: false });
    app = testApp(createDb(sql), async (tripId) => void published.push(tripId));
    client = testClient(app);
  });

  afterAll(() => drop());

  type Guest = Awaited<ReturnType<typeof signInAsGuest>>;
  const as = (user: Guest) => ({ headers: user.headers });
  const trip = () => client.trips[':tripId'];
  const item = () => trip().items[':itemId'];

  /** A grill trip: Dana organizes, Noa joined. */
  async function grill() {
    const [dana, noa] = await Promise.all(['Dana', 'Noa'].map((n) => signInAsGuest(app, n)));
    const json = {
      name: 'Grill',
      startsOn: '2026-11-05',
      endsOn: '2026-11-05',
      template: 'grill' as const,
    };
    const data = await (await client.trips.$post({ json }, as(dana!))).json();
    const token = data.inviteToken;
    await client.invites[':token'].join.$post({ param: { token }, json: {} }, as(noa!));
    return { dana: dana!, noa: noa!, tripId: data.trip.id, token, items: data.items };
  }

  const add = (user: Guest, tripId: string, name: string) =>
    trip().bag.$post({ param: { tripId }, json: { name } }, as(user));
  const addOk = async (user: Guest, tripId: string, name: string) => {
    const res = await add(user, tripId, name);
    expect(res.status).toBe(201);
    return res.json();
  };
  const detail = async (user: Guest, tripId: string) => {
    const res = await trip().$get({ param: { tripId } }, as(user));
    expect(res.status).toBe(200);
    return res.json();
  };
  const pack = (user: Guest, tripId: string, itemId: string, packed: boolean) =>
    item().packed.$put({ param: { tripId, itemId }, json: { packed } }, as(user));
  const remove = (user: Guest, tripId: string, itemId: string) =>
    item().$delete({ param: { tripId, itemId } }, as(user));
  const home = async (user: Guest) => (await client.trips.$get({}, as(user))).json();
  const preview = async (token: string) =>
    (await client.invites[':token'].$get({ param: { token } })).json();

  it('adds a private item to my bag, claimed by me, that only I see', async () => {
    const { dana, noa, tripId } = await grill();
    const before = await detail(noa, tripId);
    const sunscreen = await addOk(noa, tripId, '  קרם הגנה ');
    expect(sunscreen).toMatchObject({
      name: 'קרם הגנה',
      list: 'bring',
      kind: 'single',
      quantityNeeded: 1,
      privateOwnerId: noa.id,
    });

    const mine = await detail(noa, tripId);
    expect(mine.privateItems).toEqual([sunscreen]);
    expect(mine.items).toEqual(before.items);
    expect(mine.claims).toContainEqual(
      expect.objectContaining({ itemId: sunscreen.id, userId: noa.id, quantity: 1, packed: false }),
    );

    const theirs = await detail(dana, tripId);
    expect(theirs.privateItems).toEqual([]);
    expect(JSON.stringify(theirs)).not.toContain(sunscreen.id);
    expect(JSON.stringify(theirs)).not.toContain('קרם הגנה');
  });

  it('counts towards nothing: home lists, invite preview, activity', async () => {
    const { dana, noa, tripId, token } = await grill();
    const [homeBefore, previewBefore] = await Promise.all([home(noa), preview(token)]);
    const activityBefore = await sql`select id from activity where trip_id = ${tripId}`;

    const gum = await addOk(noa, tripId, 'מסטיק');
    expect((await pack(noa, tripId, gum.id, true)).status).toBe(200);

    expect(await home(noa)).toEqual(homeBefore);
    expect((await home(dana)).trips[0]).toEqual(
      expect.objectContaining({ itemCount: homeBefore.trips[0]!.itemCount }),
    );
    expect(await preview(token)).toEqual(previewBefore);
    expect(await sql`select id from activity where trip_id = ${tripId}`).toEqual(activityBefore);

    expect((await remove(noa, tripId, gum.id)).status).toBe(204);
    expect(await sql`select id from activity where trip_id = ${tripId}`).toEqual(activityBefore);
  });

  it('tells no one over realtime when only a private item changed', async () => {
    const { noa, tripId, items } = await grill();
    published.splice(0); // Noa joining told everyone.
    const hat = await addOk(noa, tripId, 'כובע');
    expect((await pack(noa, tripId, hat.id, true)).status).toBe(200);
    expect((await pack(noa, tripId, hat.id, false)).status).toBe(200);
    expect((await remove(noa, tripId, hat.id)).status).toBe(204);
    expect(published).toEqual([]);

    // A shared item still tells everyone.
    const shared = items.find((i) => i.list === 'bring' && i.kind === 'single')!;
    const claim = item().claim.$put;
    await claim({ param: { tripId, itemId: shared.id }, json: { quantity: 1 } }, as(noa));
    expect(published).toEqual([tripId]);
  });

  it("refuses every write to someone else's private item as if it didn't exist", async () => {
    const { dana, noa, tripId } = await grill();
    const towel = await addOk(noa, tripId, 'מגבת');
    const param = { tripId, itemId: towel.id };

    expect((await pack(dana, tripId, towel.id, true)).status).toBe(404);
    expect((await remove(dana, tripId, towel.id)).status).toBe(404);
    expect((await item().$patch({ param, json: { name: 'x' } }, as(dana))).status).toBe(404);
    expect((await item().claim.$put({ param, json: { quantity: 1 } }, as(dana))).status).toBe(404);
    const expense = { description: 'x', amountAgorot: 100, shares: [dana.id], itemId: towel.id };
    expect(
      (await trip().expenses.$post({ param: { tripId }, json: expense }, as(dana))).status,
    ).toBe(400);
    const started = await trip().runs.$post(
      { param: { tripId }, json: { itemIds: [towel.id] } },
      as(dana),
    );
    expect(await started.json()).toEqual({
      run: null,
      claimed: [],
      skipped: [{ itemId: towel.id, claimedBy: null }],
    });

    // Nothing changed.
    const [row] = await sql`select name, deleted_at from items where id = ${towel.id}`;
    expect(row).toEqual({ name: 'מגבת', deleted_at: null });
    expect(await sql`select user_id, packed_at from claims where item_id = ${towel.id}`).toEqual([
      { user_id: noa.id, packed_at: null },
    ]);
  });

  it('lets the owner pack, unpack and delete it, but not edit or reclaim it', async () => {
    const { noa, tripId } = await grill();
    const charger = await addOk(noa, tripId, 'מטען');
    const param = { tripId, itemId: charger.id };

    expect((await pack(noa, tripId, charger.id, true)).status).toBe(200);
    expect((await detail(noa, tripId)).claims).toContainEqual(
      expect.objectContaining({ itemId: charger.id, packed: true }),
    );
    expect((await pack(noa, tripId, charger.id, false)).status).toBe(200);

    // Always one thing in the bag: no editing it into a qty or buy item, no claim changes.
    expect((await item().$patch({ param, json: { list: 'buy' } }, as(noa))).status).toBe(404);
    expect((await item().claim.$put({ param, json: { quantity: 0 } }, as(noa))).status).toBe(404);

    expect((await remove(noa, tripId, charger.id)).status).toBe(204);
    expect((await detail(noa, tripId)).privateItems).toEqual([]);
    expect((await pack(noa, tripId, charger.id, true)).status).toBe(404);
  });

  it('validates the name and needs active membership', async () => {
    const { noa, tripId } = await grill();
    expect((await add(noa, tripId, '   ')).status).toBe(400);
    expect((await add(noa, tripId, 'א'.repeat(61))).status).toBe(400);
    expect((await add(noa, tripId, 'א'.repeat(60))).status).toBe(201);
    const stranger = await signInAsGuest(app, 'stranger');
    expect((await add(stranger, tripId, 'x')).status).toBe(404);
  });

  it('keeps private items to one bring thing at the database too', async () => {
    const { noa, tripId } = await grill();
    const gum = await addOk(noa, tripId, 'מסטיק');
    await expect(sql`update items set list = 'buy' where id = ${gum.id}`).rejects.toThrow(
      /items_private_check/,
    );
    await expect(
      sql`update items set kind = 'qty', quantity_needed = 2 where id = ${gum.id}`,
    ).rejects.toThrow(/items_private_check/);
  });
});
