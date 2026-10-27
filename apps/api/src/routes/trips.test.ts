import { TEMPLATES, type CoverId, type TemplateId } from '@yallist/domain';
import { testClient } from 'hono/testing';
import type { Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb } from '../db/client';
import { migrate } from '../db/migrate';
import { createTestDatabase, DATABASE_URL, signInAsGuest, testApp } from '../test-db';

describe.skipIf(!DATABASE_URL)('trips, invites, items and claims', () => {
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
  const guest = (name: string) => signInAsGuest(app, name);
  const as = (user: Guest) => ({ headers: user.headers });

  async function createTrip(
    user: Guest,
    extra: { requireApproval?: boolean; template?: TemplateId; cover?: CoverId } = {},
  ) {
    const res = await client.trips.$post(
      {
        json: {
          name: 'צפון',
          startsOn: '2026-11-05',
          endsOn: '2026-11-07',
          template: 'camp',
          ...extra,
        },
      },
      as(user),
    );
    expect(res.status).toBe(201);
    return res.json();
  }

  const detail = (user: Guest, tripId: string) =>
    client.trips[':tripId'].$get({ param: { tripId } }, as(user));
  const join = (user: Guest, token: string) =>
    client.invites[':token'].join.$post({ param: { token }, json: {} }, as(user));
  const claim = (user: Guest, tripId: string, itemId: string, quantity: number) =>
    client.trips[':tripId'].items[':itemId'].claim.$put(
      { param: { tripId, itemId }, json: { quantity } },
      as(user),
    );
  const activityTypes = async (tripId: string) =>
    (
      await sql<{ type: string }[]>`
        select type from activity where trip_id = ${tripId} order by created_at`
    ).map((r) => r.type);

  /** A trip with an organizer and one active member. */
  async function tripWithMember() {
    const organizer = await guest('organizer');
    const member = await guest('member');
    const data = await createTrip(organizer);
    expect((await join(member, data.inviteToken)).status).toBe(200);
    return { organizer, member, data };
  }

  describe('create and read', () => {
    it('creates a trip from its template with the creator as organizer', async () => {
      const dana = await guest('דנה');
      const data = await createTrip(dana);

      expect(data.trip).toMatchObject({
        name: 'צפון',
        template: 'camp',
        cover: 'camp',
        status: 'planning',
      });
      expect(data.inviteToken).toMatch(/^[\w-]{22}$/);
      expect(data.members).toEqual([
        expect.objectContaining({ userId: dana.id, role: 'organizer', status: 'active' }),
      ]);
      expect(data.items).toHaveLength(TEMPLATES.camp.length);
      // The template's categories, in order, each holding its items.
      const names = (list: string) =>
        data.categories.filter((cat) => cat.list === list).map((cat) => cat.name);
      const templateNames = (list: string) => [
        ...new Set(TEMPLATES.camp.filter((t) => t.list === list).map((t) => t.category)),
      ];
      expect(names('bring')).toEqual(templateNames('bring'));
      expect(names('buy')).toEqual(templateNames('buy'));
      const first = data.categories[0]!;
      expect(data.items.filter((i) => i.categoryId === first.id).map((i) => i.name)).toEqual(
        TEMPLATES.camp.filter((t) => t.category === first.name).map((t) => t.name),
      );
      expect(await activityTypes(data.trip.id)).toEqual(['trip_created']);
    });

    it('lists my trips with item counts and what I took', async () => {
      const { organizer, member, data } = await tripWithMember();
      const single = data.items.find((i) => i.kind === 'single')!;
      expect((await claim(member, data.trip.id, single.id, 1)).status).toBe(200);

      const res = await client.trips.$get({}, as(member));
      expect(res.status).toBe(200);
      const { trips } = await res.json();
      expect(trips).toEqual([
        expect.objectContaining({
          itemCount: data.items.length,
          doneCount: 1,
          mine: [single.name],
          missingNames: data.items
            .filter((i) => i.id !== single.id)
            .slice(0, 3)
            .map((i) => i.name),
        }),
      ]);
      expect(trips[0]!.members.map((m) => m.userId)).toEqual([organizer.id, member.id]);
    });

    it('hides a trip from non-members and pending members', async () => {
      const organizer = await guest('organizer');
      const data = await createTrip(organizer, { requireApproval: true });
      const stranger = await guest('stranger');
      const pending = await guest('pending');
      expect(await (await join(pending, data.inviteToken)).json()).toMatchObject({
        status: 'pending',
      });

      expect((await detail(stranger, data.trip.id)).status).toBe(404);
      expect((await detail(pending, data.trip.id)).status).toBe(404);
      expect((await client.trips.$get({}, as(pending))).status).toBe(200);
      expect((await (await client.trips.$get({}, as(pending))).json()).trips).toEqual([]);
      const anonymous = await app.request(`/trips/${data.trip.id}`);
      expect(anonymous.status).toBe(401);
    });

    it('lets only organizers change the trip', async () => {
      const { organizer, member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const patch = (user: Guest, json: { name?: string; endsOn?: string }) =>
        client.trips[':tripId'].$patch({ param: { tripId }, json }, as(user));

      expect((await patch(member, { name: 'x' })).status).toBe(403);
      expect((await patch(organizer, { endsOn: '2026-11-01' })).status).toBe(400);
      const res = await patch(organizer, { name: 'דרום' });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ name: 'דרום', endsOn: '2026-11-07' });
    });

    it("covers a trip with its template's cover unless one is picked", async () => {
      const dana = await guest('דנה');
      expect((await createTrip(dana, { template: 'grill' })).trip.cover).toBe('picnic');
      expect((await createTrip(dana, { template: 'blank' })).trip.cover).toBe('trail');
      const picked = await createTrip(dana, { template: 'camp', cover: 'desert' });
      expect(picked.trip.cover).toBe('desert');
      expect((await (await detail(dana, picked.trip.id)).json()).trip.cover).toBe('desert');
    });

    it('changes the cover, and only to one of the covers', async () => {
      const { organizer, member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const patch = (user: Guest, cover: string) =>
        client.trips[':tripId'].$patch(
          { param: { tripId }, json: { cover: cover as CoverId } },
          as(user),
        );

      expect((await patch(member, 'city')).status).toBe(403);
      expect((await patch(organizer, 'mars')).status).toBe(400);
      const res = await patch(organizer, 'city');
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ cover: 'city', template: 'camp' });
      const { trips } = await (await client.trips.$get({}, as(member))).json();
      expect(trips[0]!.trip.cover).toBe('city');

      const bad = await client.trips.$post(
        {
          json: {
            name: 'x',
            startsOn: '2026-11-05',
            endsOn: '2026-11-05',
            template: 'camp',
            cover: 'mars' as CoverId,
          },
        },
        as(organizer),
      );
      expect(bad.status).toBe(400);
    });
  });

  describe('invites', () => {
    it('previews a trip by token without signing in, showing only the basics', async () => {
      const { data } = await tripWithMember();
      const res = await client.invites[':token'].$get({ param: { token: data.inviteToken } });
      expect(res.status).toBe(200);
      const preview = await res.json();
      expect(Object.keys(preview).sort()).toEqual([
        'cover',
        'endsOn',
        'memberCount',
        'missingCount',
        'missingItems',
        'name',
        'startsOn',
      ]);
      expect(preview).toMatchObject({
        cover: 'camp',
        memberCount: 2,
        missingCount: data.items.length,
      });
      expect(preview.missingItems).toEqual(data.items.slice(0, 6).map((i) => i.name));
    });

    it("tells a signed-in caller their own membership, and a stranger nobody's", async () => {
      const organizer = await guest('organizer');
      const data = await createTrip(organizer, { requireApproval: true });
      const [waiting, stranger, declined] = [
        await guest('waiting'),
        await guest('stranger'),
        await guest('declined'),
      ];
      await join(waiting, data.inviteToken);
      await join(declined, data.inviteToken);
      const decline = client.trips[':tripId'].members[':userId'].decline.$post(
        { param: { tripId: data.trip.id, userId: declined.id } },
        as(organizer),
      );
      expect((await decline).status).toBe(200);

      const membership = async (user?: Guest) => {
        const res = await client.invites[':token'].$get(
          { param: { token: data.inviteToken } },
          user && as(user),
        );
        return (await res.json()).membership;
      };
      const tripId = data.trip.id;
      expect(await membership(organizer)).toEqual({ status: 'active', tripId });
      expect(await membership(waiting)).toEqual({ status: 'pending', tripId });
      expect(await membership(stranger)).toEqual({ status: 'none' });
      expect(await membership(declined)).toEqual({ status: 'none' });
      expect(await membership()).toBeUndefined();
    });

    it('joins once, however many times the link is opened', async () => {
      const { member, data } = await tripWithMember();
      const again = await join(member, data.inviteToken);
      expect(await again.json()).toEqual({ tripId: data.trip.id, status: 'active' });
      const members = await (await detail(member, data.trip.id)).json();
      expect(members.members).toHaveLength(2);
      expect(await activityTypes(data.trip.id)).toEqual(['trip_created', 'member_joined']);
    });

    it('rejects a rotated token, and only organizers rotate', async () => {
      const { organizer, member, data } = await tripWithMember();
      const rotate = (user: Guest) =>
        client.trips[':tripId'].invite.rotate.$post({ param: { tripId: data.trip.id } }, as(user));
      expect((await rotate(member)).status).toBe(403);

      const res = await rotate(organizer);
      expect(res.status).toBe(200);
      const { inviteToken } = await res.json();
      expect(inviteToken).not.toBe(data.inviteToken);

      const late = await guest('late');
      const old = data.inviteToken;
      expect((await client.invites[':token'].$get({ param: { token: old } })).status).toBe(404);
      expect((await join(late, old)).status).toBe(404);
      expect((await join(late, inviteToken)).status).toBe(200);
    });
  });

  describe('members', () => {
    const memberPath = (tripId: string, userId: string) => ({ param: { tripId, userId } });

    it('approves and declines join requests', async () => {
      const organizer = await guest('organizer');
      const data = await createTrip(organizer, { requireApproval: true });
      const [yes, no] = [await guest('yes'), await guest('no')];
      await join(yes, data.inviteToken);
      await join(no, data.inviteToken);
      const members = client.trips[':tripId'].members[':userId'];

      expect((await members.approve.$post(memberPath(data.trip.id, yes.id), as(yes))).status).toBe(
        404,
      );
      expect(
        (await members.approve.$post(memberPath(data.trip.id, yes.id), as(organizer))).status,
      ).toBe(200);
      expect(
        (await members.decline.$post(memberPath(data.trip.id, no.id), as(organizer))).status,
      ).toBe(200);

      expect((await detail(yes, data.trip.id)).status).toBe(200);
      expect((await detail(no, data.trip.id)).status).toBe(404);
      expect((await join(no, data.inviteToken)).status).toBe(403);
    });

    it('never removes or demotes the last organizer', async () => {
      const { organizer, member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const members = client.trips[':tripId'].members[':userId'];
      const setRole = (userId: string, role: 'organizer' | 'member') =>
        members.role.$put({ ...memberPath(tripId, userId), json: { role } }, as(organizer));

      expect((await members.$delete(memberPath(tripId, organizer.id), as(organizer))).status).toBe(
        409,
      );
      expect((await setRole(organizer.id, 'member')).status).toBe(409);

      expect((await setRole(member.id, 'organizer')).status).toBe(200);
      expect((await setRole(organizer.id, 'member')).status).toBe(200);
      // The organizer stepped down, so they can't manage members any more.
      expect((await setRole(member.id, 'member')).status).toBe(403);
    });

    it('drops the claims of a removed member', async () => {
      const { organizer, member, data } = await tripWithMember();
      const item = data.items.find((i) => i.kind === 'single')!;
      await claim(member, data.trip.id, item.id, 1);

      const res = await client.trips[':tripId'].members[':userId'].$delete(
        memberPath(data.trip.id, member.id),
        as(organizer),
      );
      expect(res.status).toBe(200);
      const after = await (await detail(organizer, data.trip.id)).json();
      expect(after.claims).toEqual([]);
      expect((await detail(member, data.trip.id)).status).toBe(404);
      expect((await claim(member, data.trip.id, item.id, 1)).status).toBe(404);
    });
  });

  describe('items and claims', () => {
    it('caps claims at what is still needed', async () => {
      const { organizer, member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const qty = data.items.find((i) => i.kind === 'qty')!;
      const each = data.items.find((i) => i.kind === 'each')!;

      expect((await claim(member, tripId, qty.id, qty.quantityNeeded + 1)).status).toBe(409);
      expect((await claim(member, tripId, qty.id, qty.quantityNeeded - 1)).status).toBe(200);
      const over = await claim(organizer, tripId, qty.id, 2);
      expect(over.status).toBe(409);
      expect(await over.json()).toEqual({ error: 'At most 1 can be claimed' });
      expect((await claim(organizer, tripId, qty.id, 1)).status).toBe(200);
      expect((await claim(member, tripId, each.id, 2)).status).toBe(409);

      // 0 drops the claim, freeing it for others.
      expect((await claim(member, tripId, qty.id, 0)).status).toBe(200);
      expect((await claim(organizer, tripId, qty.id, qty.quantityNeeded)).status).toBe(200);
      const after = await (await detail(member, tripId)).json();
      expect(after.claims).toEqual([
        {
          itemId: qty.id,
          userId: organizer.id,
          quantity: qty.quantityNeeded,
          arrived: false,
          packed: false,
        },
      ]);
    });

    it('lets only one of two racing claims take the last unit', async () => {
      const { organizer, member, data } = await tripWithMember();
      const item = data.items.find((i) => i.kind === 'single')!;
      const results = await Promise.all([
        claim(organizer, data.trip.id, item.id, 1),
        claim(member, data.trip.id, item.id, 1),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    });

    it('rejects claims from non-members', async () => {
      const { data } = await tripWithMember();
      const stranger = await guest('stranger');
      expect((await claim(stranger, data.trip.id, data.items[0]!.id, 1)).status).toBe(404);
    });

    it('adds, edits and soft-deletes items', async () => {
      const { organizer, member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const items = client.trips[':tripId'].items;

      const bad = await items.$post(
        { param: { tripId }, json: { list: 'buy', name: 'מים', kind: 'qty' } },
        as(member),
      );
      expect(bad.status).toBe(400);
      const added = await items.$post(
        {
          param: { tripId },
          json: { list: 'buy', name: 'מים', kind: 'qty', quantityNeeded: 6 },
        },
        as(member),
      );
      expect(added.status).toBe(201);
      const item = await added.json();
      const buyCount = data.items.filter((i) => i.list === 'buy').length;
      expect(item).toMatchObject({ name: 'מים', position: buyCount, quantityNeeded: 6 });

      await claim(organizer, tripId, item.id, 4);
      const edit = (json: { quantityNeeded?: number; note?: string | null }) =>
        items[':itemId'].$patch({ param: { tripId, itemId: item.id }, json }, as(member));
      expect((await edit({ quantityNeeded: 3 })).status).toBe(409);
      expect(await (await edit({ quantityNeeded: 8, note: 'מינרליים' })).json()).toMatchObject({
        quantityNeeded: 8,
        note: 'מינרליים',
      });

      const del = await items[':itemId'].$delete(
        { param: { tripId, itemId: item.id } },
        as(member),
      );
      expect(del.status).toBe(204);
      const after = await (await detail(member, tripId)).json();
      expect(after.items.map((i) => i.id)).not.toContain(item.id);
      expect(after.claims).toEqual([]);
      expect((await claim(organizer, tripId, item.id, 1)).status).toBe(404);
      expect(await activityTypes(tripId)).toEqual([
        'trip_created',
        'member_joined',
        'item_added',
        'claim_set',
        'item_updated',
        'item_deleted',
      ]);
    });

    describe('packed', () => {
      const pack = (user: Guest, tripId: string, itemId: string, packed: boolean) =>
        client.trips[':tripId'].items[':itemId'].packed.$put(
          { param: { tripId, itemId }, json: { packed } },
          as(user),
        );
      const claimsOf = async (user: Guest, tripId: string) =>
        (await (await detail(user, tripId)).json()).claims;

      it('packs my own claim, and the whole group sees it', async () => {
        const { organizer, member, data } = await tripWithMember();
        const tripId = data.trip.id;
        const single = data.items.find((i) => i.kind === 'single')!;
        await claim(member, tripId, single.id, 1);

        const res = await pack(member, tripId, single.id, true);
        expect(await res.json()).toEqual({ itemId: single.id, userId: member.id, packed: true });
        expect(await claimsOf(organizer, tripId)).toEqual([
          { itemId: single.id, userId: member.id, quantity: 1, arrived: false, packed: true },
        ]);
        // Packing twice is a no-op; unpacking clears it.
        expect((await pack(member, tripId, single.id, true)).status).toBe(200);
        expect((await pack(member, tripId, single.id, false)).status).toBe(200);
        expect((await claimsOf(member, tripId))[0]!.packed).toBe(false);
      });

      it("refuses anyone who doesn't own a claim on the item", async () => {
        const { organizer, member, data } = await tripWithMember();
        const tripId = data.trip.id;
        const [single, unclaimed] = data.items.filter((i) => i.kind === 'single');
        await claim(member, tripId, single!.id, 1);

        expect((await pack(organizer, tripId, single!.id, true)).status).toBe(409);
        expect((await pack(organizer, tripId, single!.id, false)).status).toBe(409);
        expect((await pack(member, tripId, unclaimed!.id, true)).status).toBe(409);
        const stranger = await guest('stranger');
        expect((await pack(stranger, tripId, single!.id, true)).status).toBe(404);
        const unknown = '00000000-0000-4000-8000-000000000000';
        expect((await pack(member, tripId, unknown, true)).status).toBe(404);
        expect((await claimsOf(member, tripId))[0]!.packed).toBe(false);
      });

      it('unpacks when I claim more, and stays packed when I claim less', async () => {
        const { member, data } = await tripWithMember();
        const tripId = data.trip.id;
        const qty = data.items.find((i) => i.kind === 'qty')!;
        const packedNow = async () => (await claimsOf(member, tripId))[0]!.packed;
        await claim(member, tripId, qty.id, 1);
        await pack(member, tripId, qty.id, true);

        await claim(member, tripId, qty.id, 2);
        expect(await packedNow()).toBe(false);
        await pack(member, tripId, qty.id, true);
        await claim(member, tripId, qty.id, 1);
        expect(await packedNow()).toBe(true);
        await claim(member, tripId, qty.id, 1);
        expect(await packedNow()).toBe(true);
      });
    });
  });

  describe('editing items', () => {
    const items = () => client.trips[':tripId'].items;
    type Changes = Parameters<ReturnType<typeof items>[':itemId']['$patch']>[0]['json'];
    const edit = (user: Guest, tripId: string, itemId: string, json: Changes) =>
      items()[':itemId'].$patch({ param: { tripId, itemId }, json }, as(user));

    it('changes any field and logs which ones changed', async () => {
      // Moving to the other list leaves the item's category behind.
      const { member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const item = data.items.find((i) => i.list === 'bring' && i.kind === 'single')!;
      const res = await edit(member, tripId, item.id, {
        name: 'כיסאות',
        list: 'buy',
        kind: 'qty',
        quantityNeeded: 6,
        unit: 'יח׳',
        displayQty: '6',
        note: 'מתקפלים',
      });
      expect(res.status).toBe(200);
      const buyCount = data.items.filter((i) => i.list === 'buy').length;
      expect(await res.json()).toEqual({
        id: item.id,
        list: 'buy',
        position: buyCount,
        name: 'כיסאות',
        kind: 'qty',
        quantityNeeded: 6,
        unit: 'יח׳',
        displayQty: '6',
        note: 'מתקפלים',
      });
      const [logged] = await sql<{ payload: { fields: string[] } }[]>`
        select payload from activity where trip_id = ${tripId} and type = 'item_updated'`;
      expect(logged!.payload.fields.sort()).toEqual(
        [
          'categoryId',
          'displayQty',
          'kind',
          'list',
          'name',
          'note',
          'quantityNeeded',
          'unit',
        ].sort(),
      );
    });

    it('keeps the quantity at or above what is claimed', async () => {
      const { organizer, member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const qty = data.items.find((i) => i.kind === 'qty')!;
      expect((await edit(member, tripId, qty.id, { quantityNeeded: 6 })).status).toBe(200);
      expect((await claim(organizer, tripId, qty.id, 3)).status).toBe(200);
      expect((await claim(member, tripId, qty.id, 2)).status).toBe(200);
      const low = await edit(member, tripId, qty.id, { quantityNeeded: 4 });
      expect(low.status).toBe(409);
      expect(await low.json()).toEqual({ error: 'Less than already claimed' });
      expect((await edit(member, tripId, qty.id, { quantityNeeded: 5 })).status).toBe(200);
      expect((await edit(member, tripId, qty.id, { quantityNeeded: 1 })).status).toBe(400);
    });

    it('changes the kind only while nobody claimed the item', async () => {
      const { organizer, member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const [free, taken] = data.items.filter((i) => i.kind === 'single');
      expect((await edit(member, tripId, free!.id, { kind: 'qty' })).status).toBe(400);
      const toQty = await edit(member, tripId, free!.id, { kind: 'qty', quantityNeeded: 3 });
      expect(await toQty.json()).toMatchObject({ kind: 'qty', quantityNeeded: 3 });
      expect(
        (await edit(member, tripId, free!.id, { kind: 'each', quantityNeeded: 1 })).status,
      ).toBe(200);

      await claim(organizer, tripId, taken!.id, 1);
      const res = await edit(member, tripId, taken!.id, { kind: 'each' });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'Already claimed' });
    });

    it('keeps a bought item on the buy list', async () => {
      const { organizer, member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const [bought, open] = data.items.filter((i) => i.list === 'buy' && i.kind !== 'each');
      const expense = await client.trips[':tripId'].expenses.$post(
        {
          param: { tripId },
          json: {
            description: 'x',
            amountAgorot: 1000,
            shares: [organizer.id],
            itemId: bought!.id,
          },
        },
        as(organizer),
      );
      expect(expense.status).toBe(201);
      const res = await edit(member, tripId, bought!.id, { list: 'bring' });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'Already bought' });
      expect((await edit(member, tripId, open!.id, { list: 'bring' })).status).toBe(200);
    });

    it('hides items from non-members', async () => {
      const { data } = await tripWithMember();
      const stranger = await guest('stranger');
      const res = await edit(stranger, data.trip.id, data.items[0]!.id, { name: 'x' });
      expect(res.status).toBe(404);
    });
  });

  describe('categories', () => {
    const categories = () => client.trips[':tripId'].categories;
    const add = (user: Guest, tripId: string, list: 'bring' | 'buy', name: string) =>
      categories().$post({ param: { tripId }, json: { list, name } }, as(user));
    const rename = (user: Guest, tripId: string, categoryId: string, name: string) =>
      categories()[':categoryId'].$patch(
        { param: { tripId, categoryId }, json: { name } },
        as(user),
      );
    const reorder = (user: Guest, tripId: string, list: 'bring' | 'buy', categoryIds: string[]) =>
      categories().order.$put({ param: { tripId }, json: { list, categoryIds } }, as(user));
    const remove = (user: Guest, tripId: string, categoryId: string) =>
      categories()[':categoryId'].$delete({ param: { tripId, categoryId } }, as(user));
    const listOf = async (user: Guest, tripId: string, list: 'bring' | 'buy') =>
      (await (await categories().$get({ param: { tripId } }, as(user))).json()).categories
        .filter((cat) => cat.list === list)
        .map((cat) => cat.name);
    const items = () => client.trips[':tripId'].items;

    it('adds, renames, reorders and deletes categories, and logs each', async () => {
      const { member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const before = await listOf(member, tripId, 'buy');

      const res = await add(member, tripId, 'buy', ' פירות ');
      expect(res.status).toBe(201);
      const fruit = await res.json();
      expect(fruit).toMatchObject({ list: 'buy', name: 'פירות', position: before.length });
      // Names are unique per list, ignoring case; the other list may reuse one.
      expect((await add(member, tripId, 'buy', 'פירות')).status).toBe(409);
      expect((await add(member, tripId, 'bring', 'פירות')).status).toBe(201);
      const fruitEn = await (await add(member, tripId, 'buy', 'Fruit')).json();
      expect((await add(member, tripId, 'buy', 'FRUIT')).status).toBe(409);
      expect((await rename(member, tripId, fruitEn.id, 'פירות')).status).toBe(409);
      expect((await rename(member, tripId, fruitEn.id, 'fruit')).status).toBe(200);

      expect(await (await rename(member, tripId, fruit.id, 'פירות וירקות')).json()).toMatchObject({
        id: fruit.id,
        name: 'פירות וירקות',
      });

      const ids = data.categories.filter((cat) => cat.list === 'buy').map((cat) => cat.id);
      const order = [fruit.id, ...ids.reverse(), fruitEn.id];
      const reordered = await reorder(member, tripId, 'buy', order);
      expect(reordered.status).toBe(200);
      expect((await reordered.json()).categories.map((cat) => cat.id)).toEqual(order);
      expect(await listOf(member, tripId, 'buy')).toEqual([
        'פירות וירקות',
        ...[...before].reverse(),
        'fruit',
      ]);
      // A stale order (missing, extra or repeated categories) is refused.
      expect((await reorder(member, tripId, 'buy', order.slice(1))).status).toBe(409);
      expect((await reorder(member, tripId, 'buy', [...order, order[0]!])).status).toBe(409);
      expect((await reorder(member, tripId, 'bring', order)).status).toBe(409);

      expect((await remove(member, tripId, fruitEn.id)).status).toBe(204);
      expect((await remove(member, tripId, fruitEn.id)).status).toBe(404);
      expect(await listOf(member, tripId, 'buy')).not.toContain('fruit');

      expect((await activityTypes(tripId)).slice(2)).toEqual([
        'category_added',
        'category_added',
        'category_added',
        'category_renamed',
        'category_renamed',
        'categories_reordered',
        'category_deleted',
      ]);
    });

    it('deletes a category with items: they become uncategorized', async () => {
      const { member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const category = data.categories[0]!;
      const inside = data.items.filter((i) => i.categoryId === category.id);
      expect(inside.length).toBeGreaterThan(0);
      await items()[':itemId'].$delete({ param: { tripId, itemId: inside[0]!.id } }, as(member));

      expect((await remove(member, tripId, category.id)).status).toBe(204);
      const after = await (await detail(member, tripId)).json();
      expect(after.categories.map((cat) => cat.id)).not.toContain(category.id);
      for (const { id } of inside.slice(1)) {
        expect(after.items.find((i) => i.id === id)).not.toHaveProperty('categoryId');
      }
    });

    it('puts items into a category of their list, or none', async () => {
      const { member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const bringCat = data.categories.find((cat) => cat.list === 'bring')!;
      const buyCat = data.categories.find((cat) => cat.list === 'buy')!;
      const create = (categoryId?: string | null) =>
        items().$post(
          { param: { tripId }, json: { list: 'bring', name: 'מחצלת', kind: 'single', categoryId } },
          as(member),
        );
      const edit = (itemId: string, json: { categoryId?: string | null; list?: 'buy' }) =>
        items()[':itemId'].$patch({ param: { tripId, itemId }, json }, as(member));

      const created = await create(bringCat.id);
      expect(created.status).toBe(201);
      const item = await created.json();
      expect(item.categoryId).toBe(bringCat.id);
      expect((await create(buyCat.id)).status).toBe(400);
      expect((await create('00000000-0000-4000-8000-000000000000')).status).toBe(404);
      expect(await (await create(null)).json()).not.toHaveProperty('categoryId');

      expect((await edit(item.id, { categoryId: buyCat.id })).status).toBe(400);
      const other = data.categories.filter((cat) => cat.list === 'bring')[1]!;
      expect((await (await edit(item.id, { categoryId: other.id })).json()).categoryId).toBe(
        other.id,
      );
      expect(await (await edit(item.id, { categoryId: null })).json()).not.toHaveProperty(
        'categoryId',
      );
      const moved = await edit(item.id, { list: 'buy', categoryId: buyCat.id });
      expect(await moved.json()).toMatchObject({ list: 'buy', categoryId: buyCat.id });
    });

    it('hides categories from non-members', async () => {
      const { data } = await tripWithMember();
      const tripId = data.trip.id;
      const stranger = await guest('stranger');
      const category = data.categories[0]!;
      expect((await categories().$get({ param: { tripId } }, as(stranger))).status).toBe(404);
      expect((await add(stranger, tripId, 'bring', 'x')).status).toBe(404);
      expect((await rename(stranger, tripId, category.id, 'x')).status).toBe(404);
      expect((await reorder(stranger, tripId, 'bring', [category.id])).status).toBe(404);
      expect((await remove(stranger, tripId, category.id)).status).toBe(404);
      // A category of another trip can't be used, renamed or deleted through this one.
      const { member, data: mine } = await tripWithMember();
      expect((await rename(member, mine.trip.id, category.id, 'x')).status).toBe(404);
      expect((await remove(member, mine.trip.id, category.id)).status).toBe(404);
      expect(
        (
          await items().$post(
            {
              param: { tripId: mine.trip.id },
              json: { list: category.list, name: 'x', kind: 'single', categoryId: category.id },
            },
            as(member),
          )
        ).status,
      ).toBe(404);
    });
  });
});
