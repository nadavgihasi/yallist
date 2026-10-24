import { TEMPLATES } from '@yallist/domain';
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

  async function createTrip(user: Guest, extra: { requireApproval?: boolean } = {}) {
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

      expect(data.trip).toMatchObject({ name: 'צפון', template: 'camp', status: 'planning' });
      expect(data.inviteToken).toMatch(/^[\w-]{22}$/);
      expect(data.members).toEqual([
        expect.objectContaining({ userId: dana.id, role: 'organizer', status: 'active' }),
      ]);
      expect(data.items).toHaveLength(TEMPLATES.camp.length);
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
  });

  describe('invites', () => {
    it('previews a trip by token without signing in, showing only the basics', async () => {
      const { data } = await tripWithMember();
      const res = await client.invites[':token'].$get({ param: { token: data.inviteToken } });
      expect(res.status).toBe(200);
      const preview = await res.json();
      expect(Object.keys(preview).sort()).toEqual([
        'endsOn',
        'memberCount',
        'missingCount',
        'missingItems',
        'name',
        'startsOn',
      ]);
      expect(preview).toMatchObject({ memberCount: 2, missingCount: data.items.length });
      expect(preview.missingItems).toEqual(data.items.slice(0, 6).map((i) => i.name));
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
        { itemId: qty.id, userId: organizer.id, quantity: qty.quantityNeeded, arrived: false },
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
        { param: { tripId }, json: { list: 'buy', category: 'שתייה', name: 'מים', kind: 'qty' } },
        as(member),
      );
      expect(bad.status).toBe(400);
      const added = await items.$post(
        {
          param: { tripId },
          json: { list: 'buy', category: 'שתייה', name: 'מים', kind: 'qty', quantityNeeded: 6 },
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
  });

  describe('editing items', () => {
    const items = () => client.trips[':tripId'].items;
    type Changes = Parameters<ReturnType<typeof items>[':itemId']['$patch']>[0]['json'];
    const edit = (user: Guest, tripId: string, itemId: string, json: Changes) =>
      items()[':itemId'].$patch({ param: { tripId, itemId }, json }, as(user));

    it('changes any field and logs which ones changed', async () => {
      const { member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const item = data.items.find((i) => i.list === 'bring' && i.kind === 'single')!;
      const res = await edit(member, tripId, item.id, {
        name: 'כיסאות',
        category: item.category,
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
        category: item.category,
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
        ['displayQty', 'kind', 'list', 'name', 'note', 'quantityNeeded', 'unit'].sort(),
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
});
