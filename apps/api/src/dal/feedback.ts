import { and, count, eq, gt, isNotNull } from 'drizzle-orm';

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

export async function setFeedbackIssue(tx: Executor, id: string, issueNumber: number) {
  await tx.update(feedback).set({ githubIssueNumber: issueNumber }).where(eq(feedback.id, id));
}

/** How many GitHub issues feedback opened since `since`, across all users. */
export async function countIssuesSince(tx: Executor, since: Date) {
  const [row] = await tx
    .select({ n: count() })
    .from(feedback)
    .where(and(isNotNull(feedback.githubIssueNumber), gt(feedback.createdAt, since)));
  return row?.n ?? 0;
}
