import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * Deploys migrate before the new code goes live, so every migration runs while the previous
 * version still serves (docs/deploy.md, Database: expand, then contract). This guard flags the
 * statements that can break that version, so each one is a deliberate step.
 *
 * Safe at once, so not flagged: anything on a table created earlier in the same migration, and a
 * constraint or unique index over columns added earlier in the same migration only (the old code
 * never writes them). `IF NOT EXISTS` doesn't count as created or added: it may already exist.
 *
 * Not tried: DO blocks and functions, statements hidden in string literals or dollar quoting, a
 * `;` inside a string literal, and exotic identifier quoting. Review those by hand.
 */
function contracting(sql: string): { index: number; why: string }[] {
  const newTables = new Set<string>();
  const newColumns = new Set<string>(); // TABLE.COLUMN
  const flagged: { index: number; why: string }[] = [];
  statementsOf(sql).forEach((s, index) => {
    const created = /^CREATE TABLE (?!IF NOT EXISTS )(\S+)/.exec(s)?.[1];
    if (created) newTables.add(name(created));
    const table = targetOf(s);
    if (table) {
      for (const [, column] of s.matchAll(ADDED_COLUMN))
        newColumns.add(`${table}.${name(column ?? '')}`);
    }
    if (table && newTables.has(table)) return;
    const hit = CONTRACTING.find(([pattern]) => pattern.test(s));
    if (!hit) return;
    const [pattern, why] = hit;
    if (pattern === CONSTRAINT || pattern === UNIQUE_INDEX) {
      const columns = table && constrainedColumns(s);
      if (columns && columns.every((c) => newColumns.has(`${table}.${c}`))) return;
    }
    flagged.push({ index, why });
  });
  return flagged;
}

/** Each statement of a migration file, upper case, comments removed, whitespace collapsed. */
function statementsOf(sql: string) {
  return sql
    .split('--> statement-breakpoint')
    .flatMap((chunk) =>
      chunk
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/--[^\n]*/g, ' ')
        .split(';'),
    )
    .map((s) => s.replace(/\s+/g, ' ').trim().toUpperCase())
    .filter(Boolean);
}

const name = (identifier: string) =>
  identifier
    .replace(/"/g, '')
    .replace(/^PUBLIC\./, '')
    .replace(/\(.*$/, '');

/** The table an ALTER TABLE or CREATE INDEX statement changes. */
function targetOf(s: string) {
  const table =
    /^ALTER TABLE (?:IF EXISTS )?(?:ONLY )?(\S+)/.exec(s)?.[1] ??
    /^CREATE (?:UNIQUE )?INDEX .*? ON (?:ONLY )?([^\s(]+)/.exec(s)?.[1];
  return table && name(table);
}

const ADDED_COLUMN =
  /\bADD (?:COLUMN )?(?!IF NOT EXISTS\b|CONSTRAINT\b|CHECK\b|UNIQUE\b|PRIMARY\b|FOREIGN\b|EXCLUDE\b)("[^"]+"|\w+)/g;

/** The columns a constraint or unique index covers, or undefined if they can't be told. */
function constrainedColumns(s: string): string[] | undefined {
  const check = /\bCHECK ?\((.*)\)/.exec(s)?.[1];
  if (check !== undefined) {
    // Quoted identifiers only: "t"."c" or "c". Unquoted ones can't be told from keywords.
    const ids = [...check.replace(/'[^']*'/g, '').matchAll(/"([^"]+)"(?:\."([^"]+)")?/g)].map(
      ([, a, b]) => b ?? a ?? '',
    );
    return ids.length > 0 ? ids : undefined;
  }
  const list =
    /\b(?:UNIQUE|PRIMARY KEY|FOREIGN KEY) ?\(([^)]*)\)/.exec(s)?.[1] ??
    /^CREATE UNIQUE INDEX .*? ON \S+?(?: USING \w+)? ?\(([^)]*)\)/.exec(s)?.[1];
  const columns = list?.split(',').map((c) => c.trim());
  return columns?.every((c) => /^("[^"]+"|\w+)$/.test(c)) ? columns.map(name) : undefined;
}

const CONSTRAINT = /\bADD (?:CONSTRAINT \S+ )?(?:CHECK|UNIQUE|PRIMARY KEY|FOREIGN KEY|EXCLUDE)\b/;
const UNIQUE_INDEX = /^CREATE UNIQUE INDEX\b/;

const CONTRACTING: [RegExp, string][] = [
  [/^(?:UPDATE|DELETE|TRUNCATE)\b/, 'changes data'],
  [/^WITH\b.*\b(?:UPDATE|DELETE)\b/, 'changes data'],
  [/\bON CONFLICT\b.*\bDO UPDATE\b/, 'changes data'],
  [/\bDROP (?:TABLE|INDEX|VIEW|TYPE|SEQUENCE)\b/, 'drops a table or index'],
  [/\bDROP COLUMN\b/, 'drops a column'],
  [/\bDROP CONSTRAINT\b/, 'drops a constraint'],
  [/\bRENAME\b/, 'renames'],
  [/\bSET NOT NULL\b/, 'sets NOT NULL'],
  [/\bDROP DEFAULT\b/, 'drops a default'],
  [/\bALTER (?:COLUMN )?\S+ (?:SET DATA )?TYPE\b/, 'changes a type'],
  [
    /\bADD (?:COLUMN )?(?!CONSTRAINT\b|CHECK\b|UNIQUE\b|PRIMARY\b|FOREIGN\b|EXCLUDE\b)(?![^,]*\bDEFAULT\b)[^,]*\bNOT NULL\b/,
    'adds a NOT NULL column without a default',
  ],
  [CONSTRAINT, 'adds a constraint'],
  [UNIQUE_INDEX, 'adds a unique index'],
];

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
    'ALTER TABLE "a" ALTER "b" TYPE bigint;',
    'ALTER TABLE "a" ADD COLUMN "b" integer NOT NULL;',
    'ALTER TABLE "a" ADD "b" integer NOT NULL;',
    'ALTER TABLE "a" ADD COLUMN "b" integer DEFAULT 0, ADD COLUMN "c" integer NOT NULL;',
    'ALTER TABLE "a" ADD CONSTRAINT "a_b_check" CHECK ("a"."b" > 0);',
    'ALTER TABLE "a" ADD CHECK ("b" > 0);',
    'ALTER TABLE "a" ADD CONSTRAINT "a_b_unique" UNIQUE("b");',
    'ALTER TABLE "a" ADD UNIQUE ("b");',
    'ALTER TABLE "a" ADD CONSTRAINT "a_b_fk" FOREIGN KEY ("b") REFERENCES "b"("id");',
    'ALTER TABLE "a" ADD FOREIGN KEY ("b") REFERENCES "b"("id");',
    'CREATE UNIQUE INDEX "a_b_idx" ON "a" USING btree ("b");',
    'create unique index a_b_idx\non a (b)',
    'UPDATE "a" SET "b" = 1;',
    'delete from a where b is null',
    'WITH old AS (SELECT id FROM a) DELETE FROM b USING old WHERE b.a_id = old.id',
    'INSERT INTO "a" ("b") VALUES (1) ON CONFLICT ("b") DO UPDATE SET "c" = 2',
    // IF NOT EXISTS: the table may already exist, with the old code using it.
    'CREATE TABLE IF NOT EXISTS "a" ("id" uuid);\nALTER TABLE "a" ADD CONSTRAINT "u" UNIQUE("id");',
  ])('flags %s', (sql) => {
    expect(contracting(sql)).toHaveLength(1);
  });

  it.each([
    'CREATE TABLE "a" ("id" uuid PRIMARY KEY, "b" integer NOT NULL);',
    'ALTER TABLE "a" ADD COLUMN "b" text;',
    'ALTER TABLE "a" ADD COLUMN "b" integer DEFAULT 0 NOT NULL;',
    'ALTER TABLE "a" ADD COLUMN "b" integer NOT NULL DEFAULT(0);',
    'CREATE INDEX "a_b_idx" ON "a" USING btree ("b");',
    'INSERT INTO "a" ("b") VALUES (1);',
    'CREATE TABLE "c" ("id" uuid, "a_id" uuid REFERENCES "a"("id") ON DELETE NO ACTION ON UPDATE NO ACTION);',
    // A new table: the old code never uses it.
    'CREATE TABLE "a" ("id" uuid, "b" uuid);--> statement-breakpoint\nALTER TABLE "a" ADD CONSTRAINT "fk" FOREIGN KEY ("b") REFERENCES "b"("id");--> statement-breakpoint\nCREATE UNIQUE INDEX "a_b_idx" ON "a" USING btree ("b");',
    // Constraints over new columns only: the old code never writes them.
    'ALTER TABLE "a" ADD COLUMN "b" integer;--> statement-breakpoint\nALTER TABLE "a" ADD CONSTRAINT "a_b_check" CHECK ("a"."b" between 1 and 10);',
    'ALTER TABLE "a" ADD COLUMN "b" text;--> statement-breakpoint\nALTER TABLE "a" ADD CONSTRAINT "a_b_check" CHECK ("a"."b" in (\'x\', \'y\'));',
    'ALTER TABLE "a" ADD COLUMN "b" uuid;--> statement-breakpoint\nALTER TABLE "a" ADD CONSTRAINT "fk" FOREIGN KEY ("b") REFERENCES "public"."p"("id") ON DELETE no action ON UPDATE no action;',
    'ALTER TABLE "a" ADD COLUMN "b" uuid, ADD COLUMN "c" uuid;\nCREATE UNIQUE INDEX "a_bc_idx" ON "a" USING btree ("b","c");',
  ])('passes %s', (sql) => {
    expect(contracting(sql)).toEqual([]);
  });

  it('flags a constraint that also reads an existing column', () => {
    const sql = `ALTER TABLE "m" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "m" ADD CONSTRAINT "m_reason_check" CHECK ("m"."reason" in ('left', 'removed'));--> statement-breakpoint
ALTER TABLE "m" ADD CONSTRAINT "m_reason_status_check" CHECK ("m"."status" = 'removed' or "m"."reason" is null);`;
    expect(contracting(sql)).toEqual([{ index: 2, why: 'adds a constraint' }]);
  });

  it('flags a constraint over a column added to another table', () => {
    const sql = 'ALTER TABLE "a" ADD COLUMN "b" integer;\nALTER TABLE "c" ADD CHECK ("c"."b" > 0);';
    expect(contracting(sql)).toEqual([{ index: 1, why: 'adds a constraint' }]);
  });

  it('classifies each statement of a chunk on its own', () => {
    const sql = 'CREATE TABLE "a" ("id" uuid);\nALTER TABLE "b" DROP COLUMN "c";';
    expect(contracting(sql)).toEqual([{ index: 1, why: 'drops a column' }]);
  });
});

/**
 * The contracting statements that shipped, by migration tag and statement index (as `contracting`
 * counts them), each with why it is safe. Keyed by tag so that pull requests add separate keys.
 */
const SHIPPED_BEFORE_MIGRATE_FIRST = 'shipped when deploys migrated after the new code went live';
const LOOSER_CHECK = 'replaces a CHECK with a looser one (more values allowed)';
const ACKNOWLEDGED: Record<string, Record<number, string>> = {
  '0001_auth': { 9: `profiles.id references users: ${SHIPPED_BEFORE_MIGRATE_FIRST}` },
  '0013_drop_place_text': { 0: `drops trips.place_text: ${SHIPPED_BEFORE_MIGRATE_FIRST}` },
  '0018_more_templates': { 0: LOOSER_CHECK, 1: LOOSER_CHECK },
  '0019_more_covers': { 0: LOOSER_CHECK, 1: LOOSER_CHECK },
};

describe('migrations', () => {
  it('every migration is safe while the previous version serves', () => {
    const dir = new URL('../../drizzle/', import.meta.url);
    const journal: { entries: { tag: string }[] } = JSON.parse(
      readFileSync(new URL('meta/_journal.json', dir), 'utf8'),
    );
    const found = journal.entries.flatMap(({ tag }) =>
      contracting(readFileSync(new URL(`${tag}.sql`, dir), 'utf8')).map(({ index, why }) => ({
        key: `${tag}#${index}`,
        why,
      })),
    );
    const acknowledged = new Set(
      Object.entries(ACKNOWLEDGED).flatMap(([tag, entries]) =>
        Object.keys(entries).map((index) => `${tag}#${index}`),
      ),
    );
    const unacknowledged = found.filter(({ key }) => !acknowledged.has(key));
    expect(
      unacknowledged.map(({ key, why }) => `${key} ${why}`),
      `These migration statements can break the version still serving while the deploy runs (deploys migrate first; docs/deploy.md, "Expand, then contract"). Ship such a change one deploy after the code that depends on the old shape, or make it additive. Then acknowledge each in ACKNOWLEDGED in apps/api/src/db/migrations.test.ts, under its migration's tag and statement index, with the reason it is safe: the code that needed the old shape is already deployed, or the old code can't be affected.`,
    ).toEqual([]);
    const stale = [...acknowledged].filter((key) => !found.some((f) => f.key === key));
    expect(stale, 'ACKNOWLEDGED lists statements that are no longer flagged').toEqual([]);
  });
});
