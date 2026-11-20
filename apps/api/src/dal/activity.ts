import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';

import { activity, type RemovedReason } from '../db/schema';
import type { Executor } from '../db/tx';

/** Records a change in the trip's activity feed, in the transaction that makes it. */
export async function logActivity(
  tx: Executor,
  tripId: string,
  actor: string,
  type: string,
  payload: Record<string, unknown> = {},
) {
  await tx.insert(activity).values({ tripId, actor, type, payload });
}

const REASON_OF = {
  member_left: 'left',
  member_removed: 'removed',
  member_declined: 'declined',
} as const satisfies Record<string, RemovedReason>;

/**
 * Legacy fallback, only for a `removed` membership whose `removed_reason` is null (removed before
 * that column existed): how the user last got out of the trip, read from the activity log. Absent
 * a matching entry, `removed`, so an unknown reason never lets anyone back in.
 *
 * Not reliable once the user has linked an account: mergeUser moves `activity.actor` (who left)
 * but not the user id inside payloads (who was removed or declined). mergeUser therefore calls
 * this before it moves anything and stores the answer, so the merged membership has its reason.
 */
export async function legacyRemovedReason(
  tx: Executor,
  tripId: string,
  userId: string,
): Promise<RemovedReason> {
  const [last] = await tx
    .select({ type: activity.type })
    .from(activity)
    .where(
      and(
        eq(activity.tripId, tripId),
        or(
          and(eq(activity.type, 'member_left'), eq(activity.actor, userId)),
          and(
            inArray(activity.type, ['member_removed', 'member_declined']),
            sql`${activity.payload}->>'userId' = ${userId}`,
          ),
        ),
      ),
    )
    .orderBy(desc(activity.createdAt))
    .limit(1);
  return REASON_OF[last?.type as keyof typeof REASON_OF] ?? 'removed';
}
