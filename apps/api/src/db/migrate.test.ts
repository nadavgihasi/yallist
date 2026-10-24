import { TEMPLATES } from '@yallist/domain';
import type { Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDatabase, DATABASE_URL } from '../test-db';
import { migrate, toDsql } from './migrate';

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
      'items',
      'payments',
      'profiles',
      'sessions',
      'template_items',
      'trip_members',
      'trips',
      'users',
      'verifications',
    ]);

    const [seeded] = await sql<{ count: number }[]>`
      select count(*)::int as count from template_items`;
    expect(seeded!.count).toBe(Object.values(TEMPLATES).flat().length);
  });
});
