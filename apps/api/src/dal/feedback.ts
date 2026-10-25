import { and, asc, count, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';

import { feedback } from '../db/schema';
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
