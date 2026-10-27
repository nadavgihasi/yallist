import type { Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb, type Db } from '../db/client';
import { migrate } from '../db/migrate';
import { createTestDatabase, DATABASE_URL, signInAsGuest, testApp } from '../test-db';
import { setClaim } from './claims';
import { insertExpense } from './expenses';
import { appendItem, deleteItem } from './items';
import { insertMember } from './members';
import { insertTrip, loadTrips } from './trips';

describe.skipIf(!DATABASE_URL)('loadTrips', () => {
  let sql: Sql;
  let drop: () => Promise<void>;
  let db: Db;

  beforeAll(async () => {
    ({ sql, drop } = await createTestDatabase());
    await migrate(sql, { dsql: false });
    db = createDb(sql);
  });

  afterAll(() => drop());

  async function trip(userId: string, name: string) {
    const { id } = await insertTrip(db, {
      name,
      startsOn: '2026-11-05',
      endsOn: '2026-11-07',
      template: 'blank',
      inviteToken: `token-${name}`,
      createdBy: userId,
    });
    await insertMember(db, {
      tripId: id,
      userId,
      role: 'organizer',
      status: 'active',
      displayName: name,
    });
    return id;
  }

  const buy = (tripId: string, userId: string, name: string) =>
    appendItem(db, tripId, userId, { list: 'buy', name, kind: 'single' });

  it('returns each trip with only its own rows, and nothing for no trips', async () => {
    const { id: me } = await signInAsGuest(testApp(db), 'me');
    const [a, b] = [await trip(me, 'a'), await trip(me, 'b')];
    const inA = await buy(a, me, 'פחם');
    const inB = await buy(b, me, 'מים');
    await setClaim(db, inB.id, me, 1, false);

    const loaded = await loadTrips(db, [b, a]);
    const byName = Object.fromEntries(loaded.map((d) => [d.trip.name, d]));
    expect(byName.a!.items.map((i) => i.id)).toEqual([inA.id]);
    expect(byName.a!.claims).toEqual([]);
    expect(byName.b!.claims).toEqual([{ itemId: inB.id, userId: me, quantity: 1, arrived: false }]);
    expect(byName.b!.members).toEqual([
      expect.objectContaining({ userId: me, role: 'organizer', status: 'active' }),
    ]);
    expect(await loadTrips(db, [])).toEqual([]);
  });

  it('drops a deleted item with its claims, and unlinks its purchase', async () => {
    const { id: me } = await signInAsGuest(testApp(db), 'me');
    const tripId = await trip(me, 'c');
    const item = await buy(tripId, me, 'קרח');
    await setClaim(db, item.id, me, 1, false);
    await insertExpense(
      db,
      {
        tripId,
        itemId: item.id,
        description: 'קרח',
        amountAgorot: 1000,
        paidBy: me,
        createdBy: me,
      },
      [me],
      [item.id],
    );
    await deleteItem(db, item.id);

    const [data] = await loadTrips(db, [tripId]);
    expect(data!.items).toEqual([]);
    expect(data!.claims).toEqual([]);
    expect(data!.expenses).toEqual([
      {
        id: expect.any(String),
        itemIds: [],
        description: 'קרח',
        amountAgorot: 1000,
        paidBy: me,
        shares: [me],
        hasReceipt: false,
      },
    ]);
  });
});
