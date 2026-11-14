import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';

import { activity } from '../db/schema';
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

/**
 * Whether the user's last way out of the trip was leaving it themselves, rather than an organizer
 * removing them or declining their request to join. Both leave the membership `removed`.
 */
export async function leftOnTheirOwn(tx: Executor, tripId: string, userId: string) {
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
  return last?.type === 'member_left';
}
