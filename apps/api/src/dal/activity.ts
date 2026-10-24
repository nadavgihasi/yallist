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
