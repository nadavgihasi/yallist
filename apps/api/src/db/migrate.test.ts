import { TEMPLATES } from '@yallist/domain';
import type { Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDatabase, DATABASE_URL } from '../test-db';
import { apply, backfillCategories, backfillCovers, migrate, toDsql } from './migrate';

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

/**
 * A stand-in for a DSQL connection: `begin` runs the DDL (`ddl` returns its rows or throws), and
 * each other query, with its parameters as $n (as postgres.js sends them), is answered by the
 * first entry of `answers` whose key it contains: rows, or an error to reject with.
 */
function fakeDsql(ddl: () => unknown[], answers: Record<string, unknown[] | Error>) {
  const queries: { text: string; params: unknown[] }[] = [];
  const sql = (strings: TemplateStringsArray, ...params: unknown[]) => {
    const text = strings
      .reduce((q, s, i) => `${q}$${i}${s}`)
      .replace(/\s+/g, ' ')
      .trim();
    queries.push({ text, params });
    const answer = answers[Object.keys(answers).find((k) => text.includes(k)) ?? ''] ?? [];
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
  sql.begin = (fn: (tx: { unsafe: (q: string) => unknown }) => unknown) =>
    Promise.resolve().then(() => fn({ unsafe: () => ddl() }));
  return { sql: sql as unknown as Sql, queries };
}

const exists = () => {
  throw Object.assign(new Error('relation "a_idx" already exists'), { code: '42P07' });
};

/** The queries that wait for job `jobId` and then read how it ended. */
const waitsFor = (jobId: string) => [
  { text: 'call sys.wait_for_job($1::text)', params: [jobId] },
  { text: 'select status, details from sys.jobs where job_id = $1::text', params: [jobId] },
];

describe('apply on DSQL', () => {
  const index = 'CREATE UNIQUE INDEX "a_idx" ON "a" USING btree ("x");';

  it('calls sys.wait_for_job as a procedure, then checks the job completed', async () => {
    const { sql, queries } = fakeDsql(() => [{ job_id: 'j1' }], {
      'where job_id': [{ status: 'completed', details: null }],
    });
    await apply(sql, index, true);
    expect(queries).toEqual(waitsFor('j1'));
  });

  it('fails when the index build fails', async () => {
    const { sql } = fakeDsql(() => [{ job_id: 'j1' }], {
      'where job_id': [{ status: 'failed', details: 'Found duplicate key' }],
    });
    await expect(apply(sql, index, true)).rejects.toThrow(
      'DSQL job j1 did not complete: failed Found duplicate key',
    );
  });

  it("reports the job's details when the wait itself raises", async () => {
    const { sql } = fakeDsql(() => [{ job_id: 'j1' }], {
      wait_for_job: new Error('job failed'),
      'where job_id': [{ status: 'failed', details: 'Found duplicate key' }],
    });
    await expect(apply(sql, index, true)).rejects.toThrow(
      'DSQL job j1 did not complete: failed Found duplicate key',
    );
  });

  it('fails when the job is still running after the wait', async () => {
    const { sql } = fakeDsql(() => [{ job_id: 'j1' }], {
      'where job_id': [{ status: 'processing', details: null }],
    });
    await expect(apply(sql, index, true)).rejects.toThrow(
      'DSQL job j1 did not complete: processing',
    );
  });

  it('fails when the job is gone', async () => {
    const { sql } = fakeDsql(() => [{ job_id: 'j1' }], {});
    await expect(apply(sql, index, true)).rejects.toThrow('DSQL job j1 did not complete: unknown');
  });

  it('accepts an index an earlier run built', async () => {
    const { sql } = fakeDsql(exists, { pg_index: [{ valid: true }] });
    await apply(sql, index, true);
  });

  it('waits for an index an earlier run is still building', async () => {
    const { sql, queries } = fakeDsql(exists, {
      pg_index: [{ valid: false }],
      "status in ('submitted', 'processing')": [{ jobId: 'j2' }],
      'where job_id': [{ status: 'completed', details: null }],
    });
    await apply(sql, index, true);
    expect(queries.slice(-2)).toEqual(waitsFor('j2'));
  });

  it('fails on an index whose earlier build failed', async () => {
    const { sql } = fakeDsql(exists, { pg_index: [{ valid: false }] });
    await expect(apply(sql, index, true)).rejects.toThrow('Index a_idx is invalid');
  });

  it('rethrows other errors', async () => {
    const { sql } = fakeDsql(() => {
      throw Object.assign(new Error('syntax error'), { code: '42601' });
    }, {});
    await expect(apply(sql, 'CREATE TABLE "a" (', true)).rejects.toThrow('syntax error');
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

  it('treats statements that committed but were not recorded as applied', async () => {
    await migrate(sql, { dsql: false });
    const [{ count }] = await sql<[{ count: number }]>`
      select count(*)::int as count from __migrations`;
    // A crash after each DDL committed, before its row was written.
    await sql`delete from __migrations`;

    await migrate(sql, { dsql: false });

    const [after] = await sql<[{ count: number }]>`
      select count(*)::int as count from __migrations`;
    expect(after.count).toBe(count);
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

  it("gives trips without a cover their template's, and keeps picked ones", async () => {
    await migrate(sql, { dsql: false });
    const [user] = await sql<{ id: string }[]>`
      insert into users (name, email) values ('c', 'c@example.com') returning id`;
    await sql`insert into profiles (id, display_name, avatar_color) values (${user!.id}, 'c', '#000')`;
    const trip = (template: string, cover: string | null) => sql`
      insert into trips (name, starts_on, ends_on, template, cover, invite_token, created_by)
      values (${template}, '2026-11-05', '2026-11-07', ${template}, ${cover},
        ${`cover-${template}`}, ${user!.id})`;
    await trip('camp', null);
    await trip('grill', null);
    await trip('blank', null);
    await trip('zimmer', 'city');

    await backfillCovers(sql);
    await backfillCovers(sql);

    const covers = await sql<{ template: string; cover: string }[]>`
      select template, cover from trips where created_by = ${user!.id} order by template`;
    expect(covers).toEqual([
      { template: 'blank', cover: 'trail' },
      { template: 'camp', cover: 'camp' },
      { template: 'grill', cover: 'picnic' },
      { template: 'zimmer', cover: 'city' },
    ]);
    const [{ count }] = await sql<[{ count: number }]>`
      select count(*)::int as count from trips where cover is null`;
    expect(count).toBe(0);
  });
});
