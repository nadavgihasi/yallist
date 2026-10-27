import { and, eq, inArray, sql } from 'drizzle-orm';

import { claims, items } from '../db/schema';
import type { Executor, Tx } from '../db/tx';

export const lockClaims = (tx: Tx, itemId: string) =>
  tx.select().from(claims).where(eq(claims.itemId, itemId)).for('update');

const mine = (itemId: string, userId: string) =>
  and(eq(claims.itemId, itemId), eq(claims.userId, userId));

/**
 * Sets the user's claim on the item; 0 drops it. `existing`: their claim, if they have one.
 * Claiming more takes it out of their bag: the extra isn't packed yet.
 */
export async function setClaim(
  tx: Executor,
  itemId: string,
  userId: string,
  quantity: number,
  existing: { quantity: number } | undefined,
) {
  if (quantity === 0) await tx.delete(claims).where(mine(itemId, userId));
  else if (!existing) await tx.insert(claims).values({ itemId, userId, quantity });
  else {
    const unpack = quantity > existing.quantity ? { packedAt: null } : {};
    await tx
      .update(claims)
      .set({ quantity, ...unpack })
      .where(mine(itemId, userId));
  }
}

/** Packs or unpacks the user's claim. False when they have no claim on the item. */
export async function setPacked(tx: Executor, itemId: string, userId: string, packed: boolean) {
  const updated = await tx
    .update(claims)
    .set({ packedAt: packed ? sql`now()` : null })
    .where(mine(itemId, userId))
    .returning({ itemId: claims.itemId });
  return updated.length > 0;
}

/** Drops the user's claims on every item of the trip. */
export async function deleteMemberClaims(tx: Executor, tripId: string, userId: string) {
  const tripItems = tx.select({ id: items.id }).from(items).where(eq(items.tripId, tripId));
  await tx.delete(claims).where(and(eq(claims.userId, userId), inArray(claims.itemId, tripItems)));
}
