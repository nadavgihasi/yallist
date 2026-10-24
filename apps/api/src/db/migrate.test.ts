import { TEMPLATES } from '@yallist/domain';
import postgres, { type Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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

// Needs Postgres (CI provides one). Each run migrates a fresh, throwaway database.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)('migrate', () => {
  const name = `yallist_test_${process.pid}`;
  let admin: Sql;
  let sql: Sql;

  beforeAll(async () => {
    admin = postgres(url!, { onnotice: () => {} });
    await admin.unsafe(`create database ${name}`);
    const testUrl = new URL(url!);
    testUrl.pathname = `/${name}`;
    sql = postgres(testUrl.href, { onnotice: () => {} });
  });

  afterAll(async () => {
    await sql.end();
    await admin.unsafe(`drop database ${name}`);
    await admin.end();
  });

  it('creates the schema and seeds templates, and can run again', async () => {
    await migrate(sql, { dsql: false });
    await migrate(sql, { dsql: false });

    const tables = await sql<{ name: string }[]>`
      select table_name as name from information_schema.tables where table_schema = 'public'`;
    expect(tables.map((t) => t.name).sort()).toEqual([
      '__migrations',
      'activity',
      'claims',
      'expense_shares',
      'expenses',
      'items',
      'payments',
      'profiles',
      'template_items',
      'trip_members',
      'trips',
    ]);

    const [seeded] = await sql<{ count: number }[]>`
      select count(*)::int as count from template_items`;
    expect(seeded!.count).toBe(Object.values(TEMPLATES).flat().length);
  });
});
