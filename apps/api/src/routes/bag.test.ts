import { testClient } from 'hono/testing';
import type { Sql } from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { mergeUser } from '../dal/profiles';
import { createDb } from '../db/client';
import { migrate } from '../db/migrate';
import { createTestDatabase, DATABASE_URL, signInAsGuest, testApp } from '../test-db';

describe.skipIf(!DATABASE_URL)('my bag', () => {
  let sql: Sql;
  let drop: () => Promise<void>;
  let app: ReturnType<typeof testApp>;
  let client: ReturnType<typeof testClient<ReturnType<typeof testApp>>>;
  let published: string[];

  beforeAll(async () => {
    ({ sql, drop } = await createTestDatabase());
    await migrate(sql, { dsql: false });
    app = testApp(createDb(sql), async (tripId) => {
      published.push(tripId);
    });
    client = testClient(app);
  });
  beforeEach(() => {
    published = [];
  });
  afterAll(() => drop());

  type Guest = Awaited<ReturnType<typeof signInAsGuest>>;
  const as = (user: Guest) => ({ headers: user.headers });
  const bag = async (user: Guest) => (await (await client.me.bag.$get({}, as(user))).json()).items;
  const add = (user: Guest, ...items: { name: string; quantity?: number }[]) =>
    client.me.bag.$post({ json: { items } }, as(user));
  const detail = async (user: Guest, tripId: string) =>
    (await client.trips[':tripId'].$get({ param: { tripId } }, as(user))).json();
  const pack = (user: Guest, tripId: string, itemId: string, packed: boolean) =>
    client.trips[':tripId'].items[':itemId'].packed.$put(
      { param: { tripId, itemId }, json: { packed } },
      as(user),
    );

  /** A blank trip with a member, and a per-person and a common bring item. */
  async function trip() {
    const organizer = await signInAsGuest(app, 'organizer');
    const member = await signInAsGuest(app, 'member');
    const created = await client.trips.$post(
      { json: { name: 'טיול', startsOn: '2099-01-01', endsOn: '2099-01-02', template: 'blank' } },
      as(organizer),
    );
    const data = await created.json();
    const tripId = data.trip.id;
    await client.invites[':token'].join.$post(
      { param: { token: data.inviteToken }, json: {} },
      as(member),
    );
    const item = async (name: string, kind: 'each' | 'single') =>
      (
        await client.trips[':tripId'].items.$post(
          { param: { tripId }, json: { list: 'bring', name, kind } },
          as(organizer),
        )
      ).json();
    const each = await item('שק שינה', 'each');
    const common = await item('גזייה', 'single');
    return { organizer, member, tripId, each, common };
  }

  it('adds, changes and removes items, keeping names unique', async () => {
    const dana = await signInAsGuest(app, 'דנה');
    expect(await bag(dana)).toEqual([]);

    const res = await add(dana, { name: ' פנס ראש ' }, { name: 'מטען', quantity: 2 });
    expect(res.status).toBe(201);
    const items = (await res.json()).items;
    expect(items).toEqual([
      { id: expect.any(String), name: 'מטען', quantity: 2 },
      { id: expect.any(String), name: 'פנס ראש', quantity: 1 },
    ]);
    // A name already in the bag is left as it is.
    await add(dana, { name: 'מטען', quantity: 5 }, { name: 'כובע' });
    expect((await bag(dana)).map((b) => [b.name, b.quantity])).toEqual([
      ['מטען', 2],
      ['פנס ראש', 1],
      ['כובע', 1],
    ]);

    const id = items[0]!.id;
    const patched = await client.me.bag[':id'].$patch(
      { param: { id }, json: { quantity: 3 } },
      as(dana),
    );
    expect(await patched.json()).toEqual({ id, name: 'מטען', quantity: 3 });
    expect(
      (await client.me.bag[':id'].$patch({ param: { id }, json: { quantity: 0 } }, as(dana)))
        .status,
    ).toBe(400);

    expect((await client.me.bag[':id'].$delete({ param: { id } }, as(dana))).status).toBe(204);
    expect((await bag(dana)).map((b) => b.name)).toEqual(['פנס ראש', 'כובע']);
    expect((await client.me.bag[':id'].$delete({ param: { id } }, as(dana))).status).toBe(404);
    // Removed, the name can go back in.
    await add(dana, { name: 'מטען' });
    expect((await bag(dana)).map((b) => b.name)).toEqual(['פנס ראש', 'כובע', 'מטען']);
  });

  it("is only the owner's", async () => {
    const dana = await signInAsGuest(app, 'דנה');
    const yoav = await signInAsGuest(app, 'יואב');
    const [item] = (await (await add(dana, { name: 'פנס' })).json()).items;
    const param = { id: item!.id };
    expect(await bag(yoav)).toEqual([]);
    expect(
      (await client.me.bag[':id'].$patch({ param, json: { quantity: 2 } }, as(yoav))).status,
    ).toBe(404);
    expect((await client.me.bag[':id'].$delete({ param }, as(yoav))).status).toBe(404);
    expect(await bag(dana)).toEqual([item]);
  });

  it('marks per-person bring items of the same name for everyone, never common ones', async () => {
    const { organizer, member, tripId, each, common } = await trip();
    published = [];
    await add(member, { name: 'שק שינה' }, { name: 'גזייה' });
    // The member's trips refresh for everyone in them.
    expect(published).toEqual([tripId]);

    const bagClaim = { itemId: each.id, userId: member.id, quantity: 1, packed: false };
    expect((await detail(organizer, tripId)).claims).toEqual([{ ...bagClaim, fromBag: true }]);
    expect(common.id).not.toBe(each.id);

    // Packing stores the claim; unpacking leaves it to the bag again.
    expect((await pack(member, tripId, each.id, true)).status).toBe(200);
    expect((await detail(member, tripId)).claims).toEqual([
      { ...bagClaim, arrived: false, packed: true },
    ]);
    expect((await pack(member, tripId, each.id, false)).status).toBe(200);
    expect((await detail(member, tripId)).claims).toEqual([{ ...bagClaim, fromBag: true }]);
    expect(await sql`select 1 from claims where item_id = ${each.id}`).toHaveLength(0);

    // Not in my bag: nothing to pack.
    expect((await pack(organizer, tripId, each.id, true)).status).toBe(409);
  });

  it("matches an item by the catalog's other names and spellings", async () => {
    const { organizer, member, tripId, each } = await trip();
    // `שקי שינה` is `שק שינה` to the catalog: the bag marks the trip's item all the same.
    await add(member, { name: 'שקי שינה' });
    expect((await detail(organizer, tripId)).claims).toEqual([
      { itemId: each.id, userId: member.id, quantity: 1, packed: false, fromBag: true },
    ]);
    // And it is the same item when added again under another name.
    await add(member, { name: 'שק שינה' });
    expect((await bag(member)).map((b) => b.name)).toEqual(['שקי שינה']);
  });

  it('follows the bag in open trips, but never unpacks', async () => {
    const { member, tripId, each } = await trip();
    const [item] = (await (await add(member, { name: 'שק שינה' })).json()).items;
    const param = { id: item!.id };

    await client.me.bag[':id'].$delete({ param }, as(member));
    expect((await detail(member, tripId)).claims).toEqual([]);

    await add(member, { name: 'שק שינה' });
    await pack(member, tripId, each.id, true);
    const [again] = await bag(member);
    await client.me.bag[':id'].$delete({ param: { id: again!.id } }, as(member));
    expect((await detail(member, tripId)).claims).toEqual([
      expect.objectContaining({ itemId: each.id, userId: member.id, packed: true }),
    ]);
  });

  it('leaves trips that already ended as they were', async () => {
    const { member, tripId } = await trip();
    await sql`update trips set starts_on = '2020-01-01', ends_on = '2020-01-02' where id = ${tripId}`;
    await add(member, { name: 'שק שינה' });
    expect((await detail(member, tripId)).claims).toEqual([]);

    // In the bag while the trip was on, removed since: the trip still counts it.
    await sql`update bag_items set created_at = '2019-12-31' where user_id = ${member.id}`;
    const [item] = await bag(member);
    await client.me.bag[':id'].$delete({ param: { id: item!.id } }, as(member));
    expect((await detail(member, tripId)).claims).toEqual([
      expect.objectContaining({ userId: member.id, fromBag: true }),
    ]);
  });

  it('only counts active members', async () => {
    const { organizer, member, tripId } = await trip();
    await add(member, { name: 'שק שינה' });
    await client.trips[':tripId'].members[':userId'].$delete(
      { param: { tripId, userId: member.id } },
      as(organizer),
    );
    expect((await detail(organizer, tripId)).claims).toEqual([]);
  });

  it('moves to the account a guest links, which keeps its own row for a shared name', async () => {
    const guest = await signInAsGuest(app, 'guest');
    const account = await signInAsGuest(app, 'account');
    await add(guest, { name: 'פנס', quantity: 2 }, { name: 'כובע' });
    await add(account, { name: 'פנס' });
    await mergeUser(createDb(sql), guest.id, account.id);
    expect((await bag(account)).map((b) => [b.name, b.quantity])).toEqual(
      expect.arrayContaining([
        ['פנס', 1],
        ['כובע', 1],
      ]),
    );
    expect(await bag(account)).toHaveLength(2);
  });

  it('goes with the account when it is deleted', async () => {
    const dana = await signInAsGuest(app, 'דנה');
    await add(dana, { name: 'פנס' });
    expect((await client.me.$delete({}, as(dana))).status).toBe(204);
    expect(await sql`select 1 from bag_items where user_id = ${dana.id}`).toHaveLength(0);
  });
});
