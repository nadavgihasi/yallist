import { readFileSync } from 'node:fs';

import { TEMPLATES } from '@yallist/domain';
import type { Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestDatabase, DATABASE_URL } from '../test-db';
import { apply, backfillExpenseItems, migrate, toDsql } from './migrate';

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
 * Why a migration statement could break the previous version, which serves against the new schema
 * until `sst deploy` replaces it (deploys migrate first: docs/deploy.md, Database), or undefined.
 * Statements on a table created earlier in the same migration are safe: the old code never uses
 * it. Case, whitespace, line breaks and comments don't matter.
 */
function contracting(statement: string, newTables: ReadonlySet<string> = new Set()) {
  const s = normalize(statement);
  const table =
    /^ALTER TABLE (?:ONLY )?(?:IF EXISTS )?("[^"]+"|\S+)/.exec(s)?.[1] ??
    /^CREATE (?:UNIQUE )?INDEX .*? ON (?:ONLY )?("[^"]+"|\S+)/.exec(s)?.[1];
  if (table && newTables.has(unquote(table))) return undefined;
  return CONTRACTING.find(([pattern]) => pattern.test(s))?.[1];
}

/** Upper case, comments removed, whitespace collapsed. */
const normalize = (statement: string) =>
  statement
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
const unquote = (name: string) => name.replace(/"/g, '').replace(/^PUBLIC\./, '');

const CONTRACTING: [RegExp, string][] = [
  [/(?:^|;) ?(?:UPDATE|DELETE|TRUNCATE)\b/, 'changes data'],
  [/\bDROP (?:TABLE|INDEX|VIEW|TYPE|SEQUENCE)\b/, 'drops a table or index'],
  [/\bDROP COLUMN\b/, 'drops a column'],
  [/\bDROP CONSTRAINT\b/, 'drops a constraint'],
  [/\bRENAME\b/, 'renames'],
  [/\bSET NOT NULL\b/, 'sets NOT NULL'],
  [/\bDROP DEFAULT\b/, 'drops a default'],
  [/\bALTER COLUMN \S+ (?:SET DATA )?TYPE\b/, 'changes a type'],
  [
    /\bADD COLUMN\b(?![^,;]*\bDEFAULT\b)[^,;]*\bNOT NULL\b/,
    'adds a NOT NULL column without a default',
  ],
  [/\bADD CONSTRAINT \S+ (?:CHECK|UNIQUE|PRIMARY KEY|FOREIGN KEY|EXCLUDE)\b/, 'adds a constraint'],
  [/\bCREATE UNIQUE INDEX\b/, 'adds a unique index'],
];

/** The tables a migration creates, unquoted and upper case. */
const createdTables = (statements: string[]) =>
  new Set(
    statements.flatMap((statement) => {
      const name = /^CREATE TABLE (?:IF NOT EXISTS )?("[^"]+"|\S+)/.exec(normalize(statement))?.[1];
      return name ? [unquote(name)] : [];
    }),
  );

describe('contracting', () => {
  it.each([
    'ALTER TABLE "trips" DROP COLUMN "place_text";',
    'alter table trips\n  drop column place_text',
    '-- no longer read since #200\nALTER TABLE "trips" DROP COLUMN "place_text"',
    '/* contract */ ALTER TABLE "a" DROP COLUMN "b"',
    'DROP TABLE "a";',
    'drop index "a_idx"',
    'ALTER TABLE "a" DROP CONSTRAINT "a_b_check";',
    'ALTER TABLE "a" RENAME COLUMN "b" TO "c";',
    'ALTER TABLE "a" RENAME TO "b";',
    'ALTER TABLE "a" ALTER COLUMN "b" SET NOT NULL;',
    'ALTER TABLE "a" ALTER COLUMN "b" DROP DEFAULT;',
    'ALTER TABLE "a" ALTER COLUMN "b" SET DATA TYPE bigint;',
    'ALTER TABLE "a" ALTER COLUMN "b" TYPE bigint;',
    'ALTER TABLE "a" ADD COLUMN "b" integer NOT NULL;',
    'ALTER TABLE "a" ADD COLUMN "b" integer DEFAULT 0, ADD COLUMN "c" integer NOT NULL;',
    'ALTER TABLE "a" ADD CONSTRAINT "a_b_check" CHECK ("a"."b" > 0);',
    'ALTER TABLE "a" ADD CONSTRAINT "a_b_unique" UNIQUE("b");',
    'ALTER TABLE "a" ADD CONSTRAINT "a_b_fk" FOREIGN KEY ("b") REFERENCES "b"("id");',
    'CREATE UNIQUE INDEX "a_b_idx" ON "a" USING btree ("b");',
    'create unique index a_b_idx\non a (b)',
    'UPDATE "a" SET "b" = 1;',
    'delete from a where b is null',
  ])('flags %s', (statement) => {
    expect(contracting(statement)).toBeDefined();
  });

  it.each([
    'CREATE TABLE "a" ("id" uuid PRIMARY KEY, "b" integer NOT NULL);',
    'ALTER TABLE "a" ADD COLUMN "b" text;',
    'ALTER TABLE "a" ADD COLUMN "b" integer DEFAULT 0 NOT NULL;',
    'ALTER TABLE "a" ADD COLUMN "b" integer NOT NULL DEFAULT(0);',
    'CREATE INDEX "a_b_idx" ON "a" USING btree ("b");',
    'INSERT INTO "a" ("b") VALUES (1);',
    // ON UPDATE / ON DELETE in a foreign key on a new table is not a data change.
    'CREATE TABLE "c" ("id" uuid, "a_id" uuid REFERENCES "a"("id") ON DELETE NO ACTION ON UPDATE NO ACTION);',
  ])('passes %s', (statement) => {
    expect(contracting(statement)).toBeUndefined();
  });

  it('passes constraints and unique indexes on a table created in the same migration', () => {
    const newTables = new Set(['A']);
    expect(
      contracting(
        'ALTER TABLE "a" ADD CONSTRAINT "fk" FOREIGN KEY ("b") REFERENCES "b"("id");',
        newTables,
      ),
    ).toBeUndefined();
    expect(contracting('CREATE UNIQUE INDEX "a_b_idx" ON "a" ("b");', newTables)).toBeUndefined();
    expect(contracting('CREATE UNIQUE INDEX "b_idx" ON "b" ("x");', newTables)).toBeDefined();
  });
});

/**
 * The contracting statements already shipped (`<tag>#<statement>`), each with why it was safe.
 * Before adding one, make sure the deployed code no longer needs what it removes or tightens, or
 * that it can't touch it (docs/deploy.md, Database: expand, then contract).
 */
const NEW_COLUMN =
  'on a column added earlier in the same migration, which the old code never writes';
const LOOSER_CHECK = 'replaces a CHECK with a looser one (more values allowed)';
const BEFORE_MIGRATE_FIRST = 'shipped when deploys migrated after the new code went live';
const ACKNOWLEDGED: Record<string, string> = {
  '0001_auth#9': `profiles.id references users: ${BEFORE_MIGRATE_FIRST}`,
  '0002_categories#4': NEW_COLUMN,
  '0006_trip_cover#1': NEW_COLUMN,
  '0008_shopping_runs#9': NEW_COLUMN,
  '0009_feedback_pipeline#8': NEW_COLUMN,
  '0013_drop_place_text#0': `drops trips.place_text: ${BEFORE_MIGRATE_FIRST}`,
  '0016_claims_assigned_by#1': NEW_COLUMN,
  '0018_more_templates#0': LOOSER_CHECK,
  '0018_more_templates#1': LOOSER_CHECK,
  '0019_more_covers#0': LOOSER_CHECK,
  '0019_more_covers#1': LOOSER_CHECK,
  '0020_category_color#1': NEW_COLUMN,
};

describe('migrations', () => {
  it('every migration is safe while the previous version serves', () => {
    const dir = new URL('../../drizzle/', import.meta.url);
    const journal: { entries: { tag: string }[] } = JSON.parse(
      readFileSync(new URL('meta/_journal.json', dir), 'utf8'),
    );
    const found = journal.entries.flatMap(({ tag }) => {
      const statements = readFileSync(new URL(`${tag}.sql`, dir), 'utf8')
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean);
      const newTables = createdTables(statements);
      return statements.flatMap((statement, i) => {
        const why = contracting(statement, newTables);
        return why ? [`${tag}#${i} ${why}`] : [];
      });
    });
    // On a mismatch, `found` says what each new statement does.
    expect(
      found.map((f) => f.split(' ')[0]),
      found.join('\n'),
    ).toEqual(Object.keys(ACKNOWLEDGED));
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

  const noColumn = () => {
    throw Object.assign(new Error('column "x" of relation "a" does not exist'), { code: '42703' });
  };

  it('accepts a column an earlier run dropped', async () => {
    const { sql } = fakeDsql(noColumn, {});
    await apply(sql, 'ALTER TABLE "a" DROP COLUMN "x";', true);
  });

  it('accepts a constraint an earlier run dropped', async () => {
    const { sql } = fakeDsql(() => {
      throw Object.assign(new Error('constraint "a_check" of relation "a" does not exist'), {
        code: '42704',
      });
    }, {});
    await apply(sql, 'ALTER TABLE "a" DROP CONSTRAINT "a_check";', true);
  });

  it('rethrows a missing column for anything but a DROP COLUMN', async () => {
    const { sql } = fakeDsql(noColumn, {});
    await expect(apply(sql, 'CREATE INDEX "a_idx" ON "a" ("x");', true)).rejects.toThrow(
      'does not exist',
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
      'bag_items',
      'claims',
      'expense_items',
      'expense_part_shares',
      'expense_parts',
      'expense_shares',
      'expenses',
      'feedback',
      'items',
      'payments',
      'profiles',
      'sessions',
      'shopping_runs',
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

  it('links single-item purchases to their item in expense_items, once', async () => {
    await migrate(sql, { dsql: false });
    const [user] = await sql<{ id: string }[]>`
      insert into users (name, email) values ('e', 'e@example.com') returning id`;
    const u = user!.id;
    await sql`insert into profiles (id, display_name, avatar_color) values (${u}, 'e', '#000')`;
    const [trip] = await sql<{ id: string }[]>`
      insert into trips (name, starts_on, ends_on, template, invite_token, created_by)
      values ('t', '2026-11-05', '2026-11-07', 'blank', 'expense-items', ${u}) returning id`;
    const item = async (name: string) =>
      (
        await sql<{ id: string }[]>`
          insert into items (trip_id, list, category, position, name, kind, created_by)
          values (${trip!.id}, 'buy', '', 0, ${name}, 'single', ${u}) returning id`
      )[0]!.id;
    const [meat, ice] = [await item('meat'), await item('ice')];
    const expense = async (itemId: string | null) =>
      (
        await sql<{ id: string }[]>`
          insert into expenses (trip_id, item_id, description, amount_agorot, paid_by, created_by)
          values (${trip!.id}, ${itemId}, 'x', 100, ${u}, ${u}) returning id`
      )[0]!.id;
    const [forMeat, forIce] = [await expense(meat), await expense(ice)];
    await expense(null);
    // Already linked by the new API.
    await sql`insert into expense_items (expense_id, item_id) values (${forIce}, ${ice})`;

    await backfillExpenseItems(sql);
    await backfillExpenseItems(sql);

    const links = await sql<{ expenseId: string; itemId: string }[]>`
      select expense_id as "expenseId", item_id as "itemId" from expense_items
      where item_id in (${meat}, ${ice}) order by item_id = ${meat} desc`;
    expect(links).toEqual([
      { expenseId: forMeat, itemId: meat },
      { expenseId: forIce, itemId: ice },
    ]);
  });
});
