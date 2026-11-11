import { itemKey, sameItem, type Claim } from '@yallist/domain';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import { bagItems, type items, type trips } from '../db/schema';
import type { Executor } from '../db/tx';

const live = (userId: string) => and(eq(bagItems.userId, userId), isNull(bagItems.deletedAt));

/** The user's bag, oldest first (what was added together, by name). */
export const listBag = (tx: Executor, userId: string) =>
  tx
    .select()
    .from(bagItems)
    .where(live(userId))
    .orderBy(asc(bagItems.createdAt), asc(bagItems.name));

/**
 * Adds the entries whose items aren't in the bag yet (the catalog knows an item's other names); returns the rows added. The caller holds
 * the profile's lock, so two adds of one name can't both get in.
 */
export async function addToBag(
  tx: Executor,
  userId: string,
  entries: readonly { name: string; quantity: number }[],
) {
  const have = new Set((await listBag(tx, userId)).map((b) => itemKey(b.name)));
  const fresh = [];
  for (const entry of entries) {
    const key = itemKey(entry.name);
    if (have.has(key)) continue;
    have.add(key);
    fresh.push(entry);
  }
  if (fresh.length === 0) return [];
  return tx
    .insert(bagItems)
    .values(fresh.map((e) => ({ userId, name: e.name, quantity: e.quantity })))
    .returning();
}

export async function setBagQuantity(tx: Executor, userId: string, id: string, quantity: number) {
  const [row] = await tx
    .update(bagItems)
    .set({ quantity })
    .where(and(eq(bagItems.id, id), live(userId)))
    .returning();
  return row;
}

/** Soft delete: trips that already ended keep it (see `bagClaims`). False if it isn't there. */
export async function removeFromBag(tx: Executor, userId: string, id: string) {
  const rows = await tx
    .update(bagItems)
    .set({ deletedAt: new Date() })
    .where(and(eq(bagItems.id, id), live(userId)))
    .returning({ id: bagItems.id });
  return rows.length > 0;
}

/** Whether the user's bag holds that item now, under any name the catalog gives it. */
export async function inBag(tx: Executor, userId: string, name: string) {
  const rows = await tx.select({ name: bagItems.name }).from(bagItems).where(live(userId));
  return rows.some((row) => sameItem(row.name, name));
}

/**
 * Bag rows, removed ones too, of these users: what `bagClaims` reads. All of a bag, not the rows
 * of given names, since an item's other names (`גריל` for `מנגל`) are matched in `bagClaims`.
 */
export const bagRowsFor = (tx: Executor, userIds: string[]) =>
  userIds.length === 0
    ? Promise.resolve([])
    : tx.select().from(bagItems).where(inArray(bagItems.userId, userIds));

/** A per-person bring item: the only kind the bag marks by itself (everyone brings their own). */
export const bagMarks = (item: Pick<typeof items.$inferSelect, 'list' | 'kind'>) =>
  item.list === 'bring' && item.kind === 'each';

/** The date in Israel, YYYY-MM-DD, as trip dates are written. */
const israelDate = (at: Date) => at.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });

/**
 * The claims a trip's members have through their bags: each active member, on each per-person
 * bring item they haven't claimed themselves, whose name is in their bag. Not stored, so editing
 * the bag changes every trip at once. A trip that ended keeps what the bag held on its last day:
 * a row counts if it was added by then and not removed before the day after.
 */
export function bagClaims(
  trip: Pick<typeof trips.$inferSelect, 'endsOn'>,
  activeIds: readonly string[],
  tripItems: readonly (typeof items.$inferSelect)[],
  claims: readonly Claim[],
  bagRows: readonly (typeof bagItems.$inferSelect)[],
): Claim[] {
  const held = bagRows.filter(
    (b) =>
      israelDate(b.createdAt) <= trip.endsOn &&
      (b.deletedAt === null || israelDate(b.deletedAt) > trip.endsOn),
  );
  return tripItems
    .filter(bagMarks)
    .flatMap((item) =>
      activeIds
        .filter(
          (userId) =>
            !claims.some((c) => c.itemId === item.id && c.userId === userId) &&
            held.some((b) => b.userId === userId && sameItem(b.name, item.name)),
        )
        .map((userId) => ({ itemId: item.id, userId, quantity: 1, packed: false, fromBag: true })),
    );
}
