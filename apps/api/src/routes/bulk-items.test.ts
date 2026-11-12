import type { BulkItem } from '@yallist/domain';
import { BULK_MAX_ITEMS } from '@yallist/domain';
import { testClient } from 'hono/testing';
import type { Sql } from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createDb } from '../db/client';
import { migrate } from '../db/migrate';
import { createTestDatabase, DATABASE_URL, signInAsGuest, testApp } from '../test-db';

describe.skipIf(!DATABASE_URL)('bulk add', () => {
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
  const detail = async (user: Guest, tripId: string) =>
    (await client.trips[':tripId'].$get({ param: { tripId } }, as(user))).json();
  const bulk = (user: Guest, tripId: string, items: BulkItem[]) =>
    client.trips[':tripId'].items.bulk.$post({ param: { tripId }, json: { items } }, as(user));
  const item = (name: string, extra: Partial<BulkItem> = {}): BulkItem => ({
    list: 'bring',
    name,
    kind: 'single',
    quantityNeeded: 1,
    category: null,
    ...extra,
  });
  const activity = (tripId: string) =>
    sql<{ type: string; payload: { count: number; names: string[] } }[]>`
      select type, payload from activity where trip_id = ${tripId} order by created_at`;

  /** A blank trip with one bring item, מנגל, in a category of its own. */
  async function trip() {
    const organizer = await signInAsGuest(app, 'organizer');
    const res = await client.trips.$post(
      { json: { name: 'טיול', startsOn: '2099-01-01', endsOn: '2099-01-02', template: 'blank' } },
      as(organizer),
    );
    const { trip: created, inviteToken } = await res.json();
    const tripId = created.id;
    expect((await bulk(organizer, tripId, [item('מנגל', { category: 'בישול' })])).status).toBe(201);
    return { organizer, tripId, inviteToken };
  }

  it('adds every item in one go, at the end of its list, in its category', async () => {
    const { organizer, tripId } = await trip();
    const res = await bulk(organizer, tripId, [
      item('מחצלת', { category: 'ישיבה' }),
      item('כיסאות', { kind: 'qty', quantityNeeded: 4, category: 'ישיבה' }),
      item('שק שינה', { kind: 'each' }),
      item('קרח', { list: 'buy', category: 'קפואים', displayQty: '2 שקים' }),
      // The existing category, by name, ignoring case and spaces.
      item('מלקחיים', { category: ' בישול ' }),
    ]);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.skipped).toEqual([]);
    expect(body.added.map((i) => i.name)).toEqual(['מחצלת', 'כיסאות', 'שק שינה', 'מלקחיים', 'קרח']);

    const data = await detail(organizer, tripId);
    const named = (name: string) => data.items.find((i) => i.name === name)!;
    const category = (id: string | undefined) => data.categories.find((c) => c.id === id);
    expect(named('כיסאות')).toMatchObject({ kind: 'qty', quantityNeeded: 4 });
    expect(named('שק שינה').kind).toBe('each');
    expect(named('שק שינה').categoryId).toBeUndefined();
    expect(named('קרח')).toMatchObject({ list: 'buy', displayQty: '2 שקים' });
    expect(category(named('מחצלת').categoryId)).toMatchObject({ list: 'bring', name: 'ישיבה' });
    expect(named('כיסאות').categoryId).toBe(named('מחצלת').categoryId);
    expect(category(named('קרח').categoryId)).toMatchObject({ list: 'buy', name: 'קפואים' });
    expect(named('מלקחיים').categoryId).toBe(named('מנגל').categoryId);
    expect(data.categories.filter((c) => c.name === 'בישול')).toHaveLength(1);
    // Positions follow the batch, after what was there.
    const bring = data.items
      .filter((i) => i.list === 'bring')
      .sort((a, b) => a.position - b.position);
    expect(bring.map((i) => i.name)).toEqual(['מנגל', 'מחצלת', 'כיסאות', 'שק שינה', 'מלקחיים']);
    // No claims came with them.
    expect(data.claims).toEqual([]);

    // One activity entry for the batch, and the trip's realtime event.
    const rows = await activity(tripId);
    expect(rows.at(-1)).toMatchObject({ type: 'items_added', payload: { count: 5 } });
    expect(rows.filter((r) => r.type === 'items_added')).toHaveLength(2);
    expect(published).toContain(tripId);
  });

  it('skips what the list has by name or synonym, and repeats within the batch', async () => {
    const { organizer, tripId } = await trip();
    const res = await bulk(organizer, tripId, [
      item('גריל'),
      item('מחצלת'),
      item('מחצלות'),
      // The other list is another list.
      item('מנגל', { list: 'buy' }),
    ]);
    const body = await res.json();
    expect(body.added.map((i) => i.name)).toEqual(['מחצלת', 'מנגל']);
    expect(body.skipped).toEqual(['גריל', 'מחצלות']);

    // All of it there already: nothing written, nothing logged.
    const before = (await activity(tripId)).length;
    const again = await (await bulk(organizer, tripId, [item('מחצלת'), item('גריל')])).json();
    expect(again).toEqual({ added: [], skipped: ['מחצלת', 'גריל'] });
    expect(await activity(tripId)).toHaveLength(before);
  });

  it('refuses the whole batch when one item is invalid', async () => {
    const { organizer, tripId } = await trip();
    // A qty item needs at least 2.
    const res = await bulk(organizer, tripId, [
      item('מחצלת'),
      item('כיסאות', { kind: 'qty', quantityNeeded: 1 }),
    ]);
    expect(res.status).toBe(400);
    const data = await detail(organizer, tripId);
    expect(data.items.map((i) => i.name)).toEqual(['מנגל']);
  });

  it('takes at most BULK_MAX_ITEMS, with names of up to 80 characters', async () => {
    const { organizer, tripId } = await trip();
    const many = Array.from({ length: BULK_MAX_ITEMS + 1 }, (_, i) => item(`פריט ${i}`));
    expect((await bulk(organizer, tripId, many)).status).toBe(400);
    expect((await bulk(organizer, tripId, [])).status).toBe(400);
    expect((await bulk(organizer, tripId, [item('א'.repeat(81))])).status).toBe(400);
    expect((await bulk(organizer, tripId, [item('   ')])).status).toBe(400);

    const res = await bulk(organizer, tripId, many.slice(0, BULK_MAX_ITEMS));
    expect(res.status).toBe(201);
    expect((await res.json()).added).toHaveLength(BULK_MAX_ITEMS);
  });

  it('adds each name once when two members add the same batch at once', async () => {
    const { organizer, tripId, inviteToken } = await trip();
    const member = await signInAsGuest(app, 'member');
    await client.invites[':token'].join.$post(
      { param: { token: inviteToken }, json: {} },
      as(member),
    );
    const batch = [
      item('מחצלת', { category: 'ישיבה' }),
      item('כיסאות', { kind: 'qty', quantityNeeded: 4, category: 'ישיבה' }),
      item('קרח', { list: 'buy', category: 'קפואים' }),
    ];
    const results = await Promise.all([
      bulk(organizer, tripId, batch),
      bulk(member, tripId, batch),
      bulk(organizer, tripId, batch),
    ]);
    const bodies = await Promise.all(results.map((r) => r.json()));
    expect(results.map((r) => r.status)).toEqual([201, 201, 201]);
    expect(bodies.flatMap((b) => b.added)).toHaveLength(3);
    expect(bodies.flatMap((b) => b.skipped)).toHaveLength(6);

    const data = await detail(organizer, tripId);
    const names = data.items.map((i) => i.name).sort();
    expect(names).toEqual(['כיסאות', 'מחצלת', 'מנגל', 'קרח'].sort());
    // And each new category once.
    expect(data.categories.filter((c) => c.name === 'ישיבה')).toHaveLength(1);
    expect(data.categories.filter((c) => c.name === 'קפואים')).toHaveLength(1);
  });

  it('is for active members of the trip only', async () => {
    const { tripId, inviteToken } = await trip();
    const stranger = await signInAsGuest(app, 'stranger');
    expect((await bulk(stranger, tripId, [item('מחצלת')])).status).toBe(404);

    // A member who left can't either.
    const member = await signInAsGuest(app, 'member');
    await client.invites[':token'].join.$post(
      { param: { token: inviteToken }, json: {} },
      as(member),
    );
    expect((await bulk(member, tripId, [item('מחצלת')])).status).toBe(201);
    await client.trips[':tripId'].leave.$post({ param: { tripId } }, as(member));
    expect((await bulk(member, tripId, [item('כיסא')])).status).toBe(404);

    const anonymous = await client.trips[':tripId'].items.bulk.$post({
      param: { tripId },
      json: { items: [item('כיסא')] },
    });
    expect(anonymous.status).toBe(401);
  });
});
