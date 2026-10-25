import { TEMPLATES } from '@yallist/domain';
import type { Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDatabase, DATABASE_URL } from '../test-db';
import { backfillCategories, migrate, toDsql } from './migrate';

describe('toDsql', () => {
  it('builds indexes asynchronously, without USING', () => {
    expect(toDsql('CREATE INDEX "a_idx" ON "a" USING btree ("x","y");')).toBe(
      'CREATE INDEX ASYNC "a_idx" ON "a" ("x","y")',
    );
    expect(toDsql('CREATE UNIQUE INDEX "a_idx" ON "a" USING btree ("x");')).toBe(
      'CREATE UNIQUE INDEX ASYNC "a_idx" ON "a" ("x")',
    );
  });

  it('adds constraints NOT VALID', () => {
    expect(
      toDsql('ALTER TABLE "a" ADD CONSTRAINT "fk" FOREIGN KEY ("b") REFERENCES "b"("id");'),
    ).toBe('ALTER TABLE "a" ADD CONSTRAINT "fk" FOREIGN KEY ("b") REFERENCES "b"("id") NOT VALID');
  });

  it('leaves other statements alone', () => {
    expect(toDsql('CREATE TABLE "a" ("id" uuid PRIMARY KEY)')).toBe(
      'CREATE TABLE "a" ("id" uuid PRIMARY KEY)',
    );
  });
});

describe.skipIf(!DATABASE_URL)('migrate', () => {
  let sql: Sql;
  let drop: () => Promise<void>;

  beforeAll(async () => {
    ({ sql, drop } = await createTestDatabase());
  });

  afterAll(() => drop());

  it('creates the schema and seeds templates, and can run again', async () => {
    await migrate(sql, { dsql: false });
    await migrate(sql, { dsql: false });

    const tables = await sql<{ name: string }[]>`
      select table_name as name from information_schema.tables where table_schema = 'public'`;
    expect(tables.map((t) => t.name).sort()).toEqual([
      '__migrations',
      'accounts',
      'activity',
      'claims',
      'expense_shares',
      'expenses',
      'feedback',
      'items',
      'payments',
      'profiles',
      'sessions',
      'template_items',
      'trip_categories',
      'trip_members',
      'trips',
      'users',
      'verifications',
    ]);

    const [seeded] = await sql<{ count: number }[]>`
      select count(*)::int as count from template_items`;
    expect(seeded!.count).toBe(Object.values(TEMPLATES).flat().length);
  });

  it('moves free-text item categories into trip categories', async () => {
    await migrate(sql, { dsql: false });
    const [user] = await sql<{ id: string }[]>`
      insert into users (name, email) values ('u', 'u@example.com') returning id`;
    await sql`insert into profiles (id, display_name, avatar_color) values (${user!.id}, 'u', '#000')`;
    const trip = async (token: string) =>
      (
        await sql<{ id: string }[]>`
          insert into trips (name, starts_on, ends_on, template, invite_token, created_by)
          values ('t', '2026-11-05', '2026-11-07', 'blank', ${token}, ${user!.id})
          returning id`
      )[0]!.id;
    const [a, b] = [await trip('a'), await trip('b')];
    // A category made by the new API, and items written by the old one.
    await sql`insert into trip_categories (trip_id, list, name, position)
      values (${a}, 'bring', 'Kitchen', 0)`;
    const item = (tripId: string, list: string, category: string, position: number) => sql`
      insert into items (trip_id, list, category, position, name, kind, created_by)
      values (${tripId}, ${list}, ${category}, ${position}, ${category + position}, 'single',
        ${user!.id})`;
    await item(a, 'bring', 'לינה', 2);
    await item(a, 'bring', 'kitchen', 1);
    await item(a, 'bring', 'בישול', 0);
    await item(a, 'bring', 'לינה', 3);
    await item(a, 'buy', 'לינה', 0);
    await item(b, 'bring', 'לינה', 0);

    await backfillCategories(sql);
    await backfillCategories(sql);

    const categories = await sql<{ tripId: string; list: string; name: string }[]>`
      select trip_id as "tripId", list, name from trip_categories
      order by trip_id = ${a} desc, list, position`;
    expect(categories).toEqual([
      { tripId: a, list: 'bring', name: 'Kitchen' },
      { tripId: a, list: 'bring', name: 'בישול' },
      { tripId: a, list: 'bring', name: 'לינה' },
      { tripId: a, list: 'buy', name: 'לינה' },
      { tripId: b, list: 'bring', name: 'לינה' },
    ]);
    const items = await sql<{ name: string; category: string; categoryName: string }[]>`
      select i.name, i.category, c.name as "categoryName" from items i
      join trip_categories c on c.id = i.category_id and c.list = i.list and c.trip_id = i.trip_id
      order by i.trip_id = ${a} desc, i.list, i.position`;
    expect(items).toEqual([
      { name: 'בישול0', category: '', categoryName: 'בישול' },
      { name: 'kitchen1', category: '', categoryName: 'Kitchen' },
      { name: 'לינה2', category: '', categoryName: 'לינה' },
      { name: 'לינה3', category: '', categoryName: 'לינה' },
      { name: 'לינה0', category: '', categoryName: 'לינה' },
      { name: 'לינה0', category: '', categoryName: 'לינה' },
    ]);
  });
});
