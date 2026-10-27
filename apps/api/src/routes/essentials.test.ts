import { testClient } from 'hono/testing';
import type { Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mergeUser } from '../auth';
import { copyEssentials } from '../dal/essentials';
import { createDb, type Db } from '../db/client';
import { migrate } from '../db/migrate';
import { createTestDatabase, DATABASE_URL, signInAsGuest, testApp } from '../test-db';

// הקבועים שלי (packing spec §4, step 4): my essentials arrive by themselves, as private items in
// my bag, in every trip I create or join.
describe.skipIf(!DATABASE_URL)('essentials', () => {
  let sql: Sql;
  let drop: () => Promise<void>;
  let db: Db;
  let app: ReturnType<typeof testApp>;
  let client: ReturnType<typeof testClient<ReturnType<typeof testApp>>>;

  beforeAll(async () => {
    ({ sql, drop } = await createTestDatabase());
    await migrate(sql, { dsql: false });
    db = createDb(sql);
    app = testApp(db);
    client = testClient(app);
  });

  afterAll(() => drop());

  type Guest = Awaited<ReturnType<typeof signInAsGuest>>;
  const as = (user: Guest) => ({ headers: user.headers });
  const guest = (name: string) => signInAsGuest(app, name);

  const get = async (user: Guest) => (await client.me.essentials.$get({}, as(user))).json();
  const set = (user: Guest, names: string[]) =>
    client.me.essentials.$put({ json: { names } }, as(user));
  async function createTrip(user: Guest, extra: { requireApproval?: boolean } = {}) {
    const json = {
      name: 'Camp',
      startsOn: '2026-11-05',
      endsOn: '2026-11-07',
      template: 'blank' as const,
      ...extra,
    };
    const res = await client.trips.$post({ json }, as(user));
    expect(res.status).toBe(201);
    return res.json();
  }
  const join = (user: Guest, token: string) =>
    client.invites[':token'].join.$post({ param: { token }, json: {} }, as(user));
  const detail = async (user: Guest, tripId: string) =>
    (await client.trips[':tripId'].$get({ param: { tripId } }, as(user))).json();
  const addToBag = (user: Guest, tripId: string, name: string, saveAsEssential?: boolean) =>
    client.trips[':tripId'].bag.$post(
      { param: { tripId }, json: { name, saveAsEssential } },
      as(user),
    );
  const bagNames = async (user: Guest, tripId: string) =>
    (await detail(user, tripId)).privateItems.map((i) => i.name);

  it('replaces my essentials in order, once per name ignoring case', async () => {
    const dana = await guest('Dana');
    expect(await get(dana)).toEqual({ essentials: [], pastItems: [] });
    const res = await set(dana, [' קרם הגנה ', 'Charger', 'charger', 'בגד ים']);
    expect(await res.json()).toEqual({ essentials: ['קרם הגנה', 'Charger', 'בגד ים'] });
    expect((await get(dana)).essentials).toEqual(['קרם הגנה', 'Charger', 'בגד ים']);

    await set(dana, ['בגד ים', 'קרם הגנה']);
    expect((await get(dana)).essentials).toEqual(['בגד ים', 'קרם הגנה']);
    await set(dana, []);
    expect((await get(dana)).essentials).toEqual([]);
  });

  it('validates names and keeps each user to their own', async () => {
    const [dana, noa] = [await guest('Dana'), await guest('Noa')];
    expect((await set(dana, [''])).status).toBe(400);
    expect((await set(dana, ['א'.repeat(61)])).status).toBe(400);
    expect(
      (
        await set(
          dana,
          Array.from({ length: 51 }, (_, i) => `n${i}`),
        )
      ).status,
    ).toBe(400);
    await set(dana, ['כובע']);
    expect((await get(noa)).essentials).toEqual([]);
    expect((await client.me.essentials.$get({})).status).toBe(401);
  });

  it('brings my essentials into a new trip, in my bag only', async () => {
    const [dana, noa] = [await guest('Dana'), await guest('Noa')];
    await set(dana, ['קרם הגנה', 'Charger']);
    const data = await createTrip(dana);
    const tripId = data.trip.id;

    expect(data.privateItems.map((i) => [i.name, i.privateOwnerId])).toEqual([
      ['קרם הגנה', dana.id],
      ['Charger', dana.id],
    ]);
    expect(data.items).toEqual([]);
    for (const i of data.privateItems) {
      expect(data.claims).toContainEqual(
        expect.objectContaining({ itemId: i.id, userId: dana.id }),
      );
    }

    expect((await join(noa, data.inviteToken)).status).toBe(200);
    const theirs = await detail(noa, tripId);
    expect(theirs.privateItems).toEqual([]);
    expect(JSON.stringify(theirs)).not.toContain('Charger');
  });

  it('brings them in on joining, once, skipping names already in my bag', async () => {
    const [dana, noa] = [await guest('Dana'), await guest('Noa')];
    const { trip, inviteToken } = await createTrip(dana, { requireApproval: true });
    await set(noa, ['כובע', 'Towel']);

    expect((await join(noa, inviteToken)).status).toBe(200);
    // Pending: copied already, there once she's approved.
    await client.trips[':tripId'].members[':userId'].approve.$post(
      { param: { tripId: trip.id, userId: noa.id } },
      as(dana),
    );
    expect(await bagNames(noa, trip.id)).toEqual(['כובע', 'Towel']);

    // Joining again adds nothing.
    expect((await join(noa, inviteToken)).status).toBe(200);
    expect(await bagNames(noa, trip.id)).toEqual(['כובע', 'Towel']);
  });

  it('skips essentials I already have in the trip, ignoring case', async () => {
    const dana = await guest('Dana');
    const { trip } = await createTrip(dana);
    expect((await addToBag(dana, trip.id, 'towel')).status).toBe(201);
    await set(dana, ['TOWEL', 'כובע']);
    // What create and join run, here on a trip that already has `towel` in the bag.
    await copyEssentials(db, trip.id, dana.id);
    await copyEssentials(db, trip.id, dana.id);
    expect(await bagNames(dana, trip.id)).toEqual(['towel', 'כובע']);
  });

  it('saves a bag item as an essential, once, without touching other trips', async () => {
    const dana = await guest('Dana');
    const first = await createTrip(dana);
    expect((await addToBag(dana, first.trip.id, 'Hat', true)).status).toBe(201);
    expect((await addToBag(dana, first.trip.id, 'hat', true)).status).toBe(201);
    expect((await addToBag(dana, first.trip.id, 'Gum')).status).toBe(201);
    expect((await get(dana)).essentials).toEqual(['Hat']);

    // Edits apply to new trips only.
    await set(dana, ['Hat', 'Book']);
    expect(await bagNames(dana, first.trip.id)).toEqual(['Hat', 'hat', 'Gum']);
    const second = await createTrip(dana);
    expect(second.privateItems.map((i) => i.name)).toEqual(['Hat', 'Book']);
  });

  it('lists my past private items, newest first, for suggestions', async () => {
    const dana = await guest('Dana');
    const { trip } = await createTrip(dana);
    await addToBag(dana, trip.id, 'Towel');
    await addToBag(dana, trip.id, 'Book');
    expect((await get(dana)).pastItems).toEqual(['Book', 'Towel']);
  });

  it('merges a guest’s essentials into the account, the account’s first', async () => {
    const [from, to] = [await guest('guest'), await guest('account')];
    await set(to, ['Hat', 'Book']);
    await set(from, ['hat', 'Towel']);
    await mergeUser(db, from.id, to.id);
    expect((await get(to)).essentials).toEqual(['Hat', 'Book', 'Towel']);
  });
});
