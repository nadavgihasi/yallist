import {
  and,
  asc,
  count,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';

import { feedback, type PIPELINE_STATES } from '../db/schema';
import type { Executor } from '../db/tx';

/** How many requests the user sent since `since`, for the rate limit. */
export async function countFeedbackSince(tx: Executor, userId: string, since: Date) {
  const [row] = await tx
    .select({ n: count() })
    .from(feedback)
    .where(and(eq(feedback.userId, userId), gt(feedback.createdAt, since)));
  return row?.n ?? 0;
}

export async function insertFeedback(tx: Executor, values: typeof feedback.$inferInsert) {
  const [row] = await tx.insert(feedback).values(values).returning();
  return row!;
}

export type Feedback = Awaited<ReturnType<typeof insertFeedback>>;

/** Requests without an issue that nobody is opening one for (no claim, or one older than `staleBefore`). */
const unclaimed = (staleBefore: Date) =>
  and(
    isNull(feedback.githubIssueNumber),
    or(isNull(feedback.githubIssueAt), lt(feedback.githubIssueAt, staleBefore)),
  );

/** Requests still waiting for an issue, oldest first. */
export const listUnsentFeedback = (tx: Executor, staleBefore: Date) =>
  tx.select().from(feedback).where(unclaimed(staleBefore)).orderBy(asc(feedback.createdAt));

/**
 * Claims a request for opening its issue; false if it has one, or another sender holds the claim.
 * Concurrent claims conflict on the row, so only one commits (DSQL fails the others at commit,
 * Postgres re-checks the condition after the lock).
 */
export async function claimFeedbackIssue(tx: Executor, id: string, staleBefore: Date) {
  const rows = await tx
    .update(feedback)
    .set({ githubIssueAt: sql`now()` })
    .where(and(eq(feedback.id, id), unclaimed(staleBefore)))
    .returning({ id: feedback.id });
  return rows.length > 0;
}

/** Gives up a claim after a failed send, so a later run retries. */
export async function releaseFeedbackIssue(tx: Executor, id: string) {
  await tx
    .update(feedback)
    .set({ githubIssueAt: null })
    .where(and(eq(feedback.id, id), isNull(feedback.githubIssueNumber)));
}

export async function setFeedbackIssue(tx: Executor, id: string, issueNumber: number) {
  await tx.update(feedback).set({ githubIssueNumber: issueNumber }).where(eq(feedback.id, id));
}

/** How many GitHub issues feedback opened (or is opening) since `since`, across all users. */
export async function countIssuesSince(tx: Executor, since: Date) {
  const [row] = await tx
    .select({ n: count() })
    .from(feedback)
    .where(gt(feedback.githubIssueAt, since));
  return row?.n ?? 0;
}

type PipelineState = (typeof PIPELINE_STATES)[number];

/** The request with `column` equal to `value`; the pipeline's lookups (ids, issue, prompt, PR). */
export async function findFeedback(
  tx: Executor,
  column: 'id' | 'githubIssueNumber' | 'telegramPromptId' | 'prNumber',
  value: string | number,
) {
  const [row] = await tx.select().from(feedback).where(eq(feedback[column], value)).limit(1);
  return row;
}

/**
 * Moves a request along the pipeline: sets `values` only while its state is one of `from` (null:
 * not in the pipeline yet) and `where` holds. The updated row, or undefined when another press,
 * retry or webhook got there first; concurrent ones conflict on the row, so one wins.
 */
export async function moveFeedback(
  tx: Executor,
  id: string,
  from: (PipelineState | null)[],
  values: Partial<typeof feedback.$inferInsert>,
  where?: SQL,
) {
  const states = from.filter((s) => s !== null);
  const [row] = await tx
    .update(feedback)
    .set(values)
    .where(
      and(
        eq(feedback.id, id),
        or(
          states.length ? inArray(feedback.pipelineState, states) : undefined,
          from.includes(null) ? isNull(feedback.pipelineState) : undefined,
        ),
        where,
      ),
    )
    .returning();
  return row;
}

/**
 * Approved requests whose run is still going: with an open PR, or approved in the last day (a run
 * that opened no PR by then has stopped). Approving waits while there are too many.
 */
export async function countRunning(tx: Executor) {
  const [row] = await tx
    .select({ n: count() })
    .from(feedback)
    .where(
      and(
        eq(feedback.pipelineState, 'approved'),
        or(isNotNull(feedback.prNumber), gt(feedback.approvedAt, sql`now() - interval '1 day'`)),
      ),
    );
  return row?.n ?? 0;
}
