import { and, eq, inArray, isNull } from 'drizzle-orm';

import { itemPacked, items } from '../db/schema';
import type { Executor } from '../db/tx';

/** Ticks or unticks the item as packed by the user. The caller holds the item's lock. */
export async function setPacked(tx: Executor, itemId: string, userId: string, packed: boolean) {
  const mine = and(eq(itemPacked.itemId, itemId), eq(itemPacked.userId, userId));
  if (!packed) {
    await tx.delete(itemPacked).where(mine);
    return;
  }
  const [existing] = await tx.select().from(itemPacked).where(mine);
  if (!existing) await tx.insert(itemPacked).values({ itemId, userId });
}

/** The live items of the trip the user packed. */
export async function packedItemIds(tx: Executor, tripId: string, userId: string) {
  const rows = await tx
    .select({ itemId: itemPacked.itemId })
    .from(itemPacked)
    .innerJoin(items, eq(items.id, itemPacked.itemId))
    .where(and(eq(itemPacked.userId, userId), eq(items.tripId, tripId), isNull(items.deletedAt)));
  return rows.map((r) => r.itemId);
}

/** Clears everyone's packed tick on the item, when it's deleted. */
export const deleteItemPacked = (tx: Executor, itemId: string) =>
  tx.delete(itemPacked).where(eq(itemPacked.itemId, itemId));

/** Clears the user's packed ticks on every item of the trip, when they're removed from it. */
export async function deleteMemberPacked(tx: Executor, tripId: string, userId: string) {
  const tripItems = tx.select({ id: items.id }).from(items).where(eq(items.tripId, tripId));
  await tx
    .delete(itemPacked)
    .where(and(eq(itemPacked.userId, userId), inArray(itemPacked.itemId, tripItems)));
}
