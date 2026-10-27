import type { Claim } from '@yallist/domain';
import { and, eq, inArray } from 'drizzle-orm';

import { claims, items } from '../db/schema';
import type { Executor, Tx } from '../db/tx';

/** The item's claims, locked. */
export async function lockClaims(tx: Tx, itemId: string): Promise<Claim[]> {
  const rows = await tx.select().from(claims).where(eq(claims.itemId, itemId)).for('update');
  return rows.map((c) => ({ ...c, runId: c.runId ?? undefined }));
}

/** Sets the user's claim on the item; 0 drops it. `existing`: whether they already have one. */
export async function setClaim(
  tx: Executor,
  itemId: string,
  userId: string,
  quantity: number,
  existing: boolean,
) {
  const mine = and(eq(claims.itemId, itemId), eq(claims.userId, userId));
  if (quantity === 0) await tx.delete(claims).where(mine);
  else if (existing) await tx.update(claims).set({ quantity }).where(mine);
  else await tx.insert(claims).values({ itemId, userId, quantity });
}

/** Drops the user's claims on every item of the trip. */
export async function deleteMemberClaims(tx: Executor, tripId: string, userId: string) {
  const tripItems = tx.select({ id: items.id }).from(items).where(eq(items.tripId, tripId));
  await tx.delete(claims).where(and(eq(claims.userId, userId), inArray(claims.itemId, tripItems)));
}
