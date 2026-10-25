import { eq, sql } from 'drizzle-orm';

import type { Db } from '../db/client';
import { profiles } from '../db/schema';
import { transact, type Executor } from '../db/tx';

export async function findProfile(tx: Executor, userId: string) {
  const [profile] = await tx.select().from(profiles).where(eq(profiles.id, userId));
  return profile;
}

/** Locks the user's profile row until the transaction ends, serializing that user's writes. */
export async function lockProfile(tx: Executor, userId: string) {
  await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, userId)).for('update');
}

/** Changes the given profile fields; returns the updated profile. */
export async function updateProfile(
  tx: Executor,
  userId: string,
  changes: Partial<Omit<typeof profiles.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>>,
) {
  const [profile] = await tx
    .update(profiles)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(profiles.id, userId))
    .returning();
  return profile;
}

export const insertProfile = (tx: Executor, values: typeof profiles.$inferInsert) =>
  tx.insert(profiles).values(values);

/** The user's name as they set it in their profile. */
export const displayNameOf = async (tx: Executor, user: { id: string; name: string }) =>
  (await findProfile(tx, user.id))?.displayName ?? user.name;

/** Tables keyed by (something, user_id): where both users have a row, the account's wins. */
const USER_KEYED = [
  ['trip_members', 'trip_id'],
  ['claims', 'item_id'],
  ['expense_shares', 'expense_id'],
] as const;

/** Every column that references a profile. */
const USER_COLUMNS = [
  ['trips', 'created_by'],
  ['trip_members', 'user_id'],
  ['items', 'created_by'],
  ['claims', 'user_id'],
  ['expenses', 'paid_by'],
  ['expenses', 'created_by'],
  ['expense_shares', 'user_id'],
  ['payments', 'from_user'],
  ['payments', 'to_user'],
  ['activity', 'actor'],
  ['feedback', 'user_id'],
] as const;

/** Moves everything of user `from` to user `to` and deletes `from`'s profile. */
export async function mergeUser(db: Db, from: string, to: string) {
  const id = sql.identifier;
  await transact(db, async (tx) => {
    // Where both are in a trip, the account keeps the stronger membership, so a trip never
    // loses its organizer: an active organizer beats member, and active beats pending beats
    // removed. A removed organizer's role doesn't carry over.
    await tx.execute(sql`
      update trip_members b set
        role = case
          when (a.role = 'organizer' and a.status = 'active')
            or (b.role = 'organizer' and b.status = 'active') then 'organizer'
          else 'member' end,
        status = case
          when a.status = 'active' or (a.status = 'pending' and b.status = 'removed') then a.status
          else b.status end
      from trip_members a
      where a.trip_id = b.trip_id and a.user_id = ${from} and b.user_id = ${to}`);
    // Where both took part of a qty item, the account takes both parts, so nothing goes missing.
    // Every claim fit under the item's quantity at once, so their sum does too.
    await tx.execute(sql`
      update claims b set quantity = b.quantity + a.quantity
      from claims a, items i
      where a.item_id = b.item_id and i.id = b.item_id and i.kind = 'qty'
        and a.user_id = ${from} and b.user_id = ${to}`);
    for (const [table, key] of USER_KEYED) {
      await tx.execute(sql`
        delete from ${id(table)} a where a.user_id = ${from} and exists (
          select 1 from ${id(table)} b where b.${id(key)} = a.${id(key)} and b.user_id = ${to})`);
    }
    for (const [table, column] of USER_COLUMNS) {
      await tx.execute(
        sql`update ${id(table)} set ${id(column)} = ${to} where ${id(column)} = ${from}`,
      );
    }
    await tx.delete(profiles).where(eq(profiles.id, from));
  });
}
