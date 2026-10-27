import { readFileSync } from 'node:fs';

import { coverFor, TEMPLATES, type TemplateId } from '@yallist/domain';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { Sql } from 'postgres';

import { templateItems } from './schema';
import { withRetry } from './tx';

const DIR = new URL('../../drizzle/', import.meta.url);

/**
 * Applies drizzle-kit's migrations in drizzle/, reloads the template seed, then moves free-text
 * item categories into trip_categories and gives trips without a cover their template's.
 * DSQL allows one DDL statement per transaction, so each statement runs and is recorded on its
 * own; a failed deploy resumes from the statement that failed. A statement can commit without
 * being recorded (a crash in between), so on the next run its "already exists" error means it
 * was applied.
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
      await apply(sql, statement, dsql);
      await sql`insert into __migrations (tag, statement) values (${tag}, ${i})`;
    }
  }

  await seedTemplates(sql);
  await backfillCategories(sql);
  await backfillCovers(sql);
  await backfillExpenseItems(sql);
}

/** SQLSTATEs of re-running a CREATE TABLE/INDEX, ADD COLUMN or ADD CONSTRAINT that committed. */
const ALREADY_EXISTS = new Set([
  '42P07', // duplicate_table: tables, indexes
  '42701', // duplicate_column
  '42710', // duplicate_object: constraints
]);

/**
 * Runs one migration statement. On DSQL an index is built by a background job: wait for it, and
 * fail if it fails, so an index that was never built (e.g. a unique index over duplicates) isn't
 * recorded as applied. An index left over from an earlier run must be built too.
 */
export async function apply(sql: Sql, statement: string, dsql: boolean) {
  let jobId: string | undefined;
  try {
    const rows = await sql.begin((tx) => tx.unsafe(dsql ? toDsql(statement) : statement));
    jobId = (rows as { job_id?: string }[])[0]?.job_id;
  } catch (error) {
    if (!ALREADY_EXISTS.has((error as { code?: string }).code ?? '')) throw error;
    const index = /^CREATE (?:UNIQUE )?INDEX "([^"]+)"/.exec(statement)?.[1];
    if (dsql && index) await awaitExistingIndex(sql, index);
    return;
  }
  if (jobId) await waitForJob(sql, jobId);
}

/**
 * Blocks until a DSQL job finishes, then throws with its details unless it completed.
 * sys.wait_for_job is a procedure (so CALL, not SELECT), and CALL returns no rows: sys.jobs is
 * what says how the job ended. It may also raise when the job fails, in which case the job's
 * status still explains why.
 */
async function waitForJob(sql: Sql, jobId: string) {
  const waited = await sql`call sys.wait_for_job(${jobId}::text)`.then(
    () => undefined,
    (error: unknown) => error,
  );
  const [job] = await sql<{ status: string; details: string | null }[]>`
    select status, details from sys.jobs where job_id = ${jobId}::text`;
  if (job?.status === 'completed') return;
  throw new Error(
    `DSQL job ${jobId} did not complete: ${job ? `${job.status} ${job.details ?? ''}` : 'unknown'}`,
    { cause: waited },
  );
}

/**
 * An index created by an earlier run: valid, still being built (wait for its job), or its build
 * failed, which DSQL leaves as an invalid index that has to be dropped before it can be rebuilt.
 */
async function awaitExistingIndex(sql: Sql, name: string) {
  const [index] = await sql<{ valid: boolean }[]>`
    select i.indisvalid as valid from pg_index i join pg_class c on c.oid = i.indexrelid
    where c.relname = ${name}`;
  if (index?.valid) return;
  const [job] = await sql<{ jobId: string }[]>`
    select job_id as "jobId" from sys.jobs
    where object_name = ${`public.${name}`} and status in ('submitted', 'processing')`;
  if (!job) throw new Error(`Index ${name} is invalid (its build failed): drop it and redeploy`);
  await waitForJob(sql, job.jobId);
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

/**
 * Data step for trip_categories (0002): items still carrying a free-text category get a
 * category of that name in their trip and list (an existing one, ignoring case, or a new one
 * after the list's others, in order of the items' first appearance), and their text is cleared.
 * Runs on every deploy, so items written by the previous API version mid-deploy are moved too;
 * once everything is moved it finds nothing. One transaction per trip, which keeps each under
 * DSQL's 3,000-row limit and apart from the DDL.
 */
export async function backfillCategories(sql: Sql) {
  const groups = await sql<{ tripId: string; list: string; name: string }[]>`
    select trip_id as "tripId", list, category as name from items
    where category_id is null and category <> '' and deleted_at is null
    group by trip_id, list, category
    order by trip_id, list, min(position)`;
  for (const tripId of new Set(groups.map((g) => g.tripId))) {
    await withRetry(() =>
      sql.begin(async (tx) => {
        for (const { list, name } of groups.filter((g) => g.tripId === tripId)) {
          const [existing] = await tx<{ id: string }[]>`
            select id from trip_categories
            where trip_id = ${tripId} and list = ${list} and lower(name) = lower(${name})`;
          const [category] = existing
            ? [existing]
            : await tx<{ id: string }[]>`
                insert into trip_categories (trip_id, list, name, position)
                select ${tripId}, ${list}, ${name}, coalesce(max(position) + 1, 0)
                from trip_categories where trip_id = ${tripId} and list = ${list}
                returning id`;
          await tx`
            update items set category_id = ${category.id}, category = ''
            where trip_id = ${tripId} and list = ${list} and category = ${name}
              and category_id is null and deleted_at is null`;
        }
      }),
    );
  }
}

/**
 * Data step for trips.cover (0006): trips created before it, or by the previous API version
 * mid-deploy, get their template's cover. Runs on every deploy; 1,000 trips per transaction
 * keeps each under DSQL's 3,000-row limit.
 */
export async function backfillCovers(sql: Sql) {
  for (;;) {
    const trips = await sql<{ id: string; template: TemplateId }[]>`
      select id, template from trips where cover is null limit 1000`;
    if (trips.length === 0) return;
    await withRetry(() =>
      sql.begin(async (tx) => {
        for (const template of new Set(trips.map((t) => t.template))) {
          const ids = trips.filter((t) => t.template === template).map((t) => t.id);
          await tx`update trips set cover = ${coverFor(template)} where id in ${tx(ids)}`;
        }
      }),
    );
  }
}

/**
 * Data step for expense_items (0007): each single-item purchase (expenses.item_id) gets its
 * expense_items row, which is what "bought" reads now. Runs on every deploy, so purchases the
 * previous API version made mid-deploy are linked too. 1,000 per transaction keeps each under
 * DSQL's 3,000-row limit.
 */
export async function backfillExpenseItems(sql: Sql) {
  for (;;) {
    const linked = await withRetry(() =>
      sql.begin(
        (tx) => tx`
          insert into expense_items (expense_id, item_id)
          select e.id, e.item_id from expenses e
          where e.item_id is not null
            and not exists (select 1 from expense_items x where x.item_id = e.item_id)
          limit 1000`,
      ),
    );
    if (linked.count === 0) return;
  }
}
