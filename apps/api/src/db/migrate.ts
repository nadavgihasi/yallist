import { readFileSync } from 'node:fs';

import { TEMPLATES, type TemplateId } from '@yallist/domain';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { Sql } from 'postgres';

import { templateItems } from './schema';

const DIR = new URL('../../drizzle/', import.meta.url);

/**
 * Applies drizzle-kit's migrations in drizzle/, then reloads the template seed.
 * DSQL allows one DDL statement per transaction, so each statement runs and is recorded on its
 * own; a failed deploy resumes from the statement that failed.
 */
export async function migrate(sql: Sql, { dsql }: { dsql: boolean }) {
  await sql`create table if not exists __migrations (
    tag text not null,
    statement integer not null,
    applied_at timestamptz not null default now(),
    primary key (tag, statement)
  )`;
  const applied = new Set(
    (await sql<{ id: string }[]>`select tag || '#' || statement as id from __migrations`).map(
      (r) => r.id,
    ),
  );

  const journal: { entries: { tag: string }[] } = JSON.parse(
    readFileSync(new URL('meta/_journal.json', DIR), 'utf8'),
  );
  for (const { tag } of journal.entries) {
    const statements = readFileSync(new URL(`${tag}.sql`, DIR), 'utf8')
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const [i, statement] of statements.entries()) {
      if (applied.has(`${tag}#${i}`)) continue;
      await sql.begin((tx) => tx.unsafe(dsql ? toDsql(statement) : statement));
      await sql`insert into __migrations (tag, statement) values (${tag}, ${i})`;
    }
  }

  await seedTemplates(sql);
}

/**
 * Rewrites drizzle-kit's Postgres DDL into DSQL's dialect: indexes are always built
 * asynchronously (and take no USING clause), and constraints added by ALTER TABLE must be
 * NOT VALID. They are still enforced for new writes; a constraint added to a table that already
 * has rows needs a follow-up `ALTER TABLE ASYNC ... VALIDATE CONSTRAINT`.
 */
export function toDsql(statement: string): string {
  const s = statement.replace(/;$/, '');
  if (/^CREATE (UNIQUE )?INDEX /.test(s)) {
    return s.replace(/INDEX /, 'INDEX ASYNC ').replace(/ USING btree/, '');
  }
  if (/^ALTER TABLE .* ADD CONSTRAINT /.test(s)) return `${s} NOT VALID`;
  return s;
}

/** Replaces template_items with the current TEMPLATES, so it never drifts from the code. */
async function seedTemplates(sql: Sql) {
  const rows = Object.entries(TEMPLATES).flatMap(([template, items]) =>
    (['bring', 'buy'] as const).flatMap((list) =>
      items
        .filter((item) => item.list === list)
        .map((item, position) => ({ ...item, template: template as TemplateId, position })),
    ),
  );
  await drizzle(sql).transaction(async (tx) => {
    await tx.delete(templateItems);
    await tx.insert(templateItems).values(rows);
  });
}
