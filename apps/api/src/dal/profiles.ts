import { AVATAR_COLORS } from '@yallist/domain';
import { and, count, eq, inArray, sql } from 'drizzle-orm';

import type { Db } from '../db/client';
import {
  accounts,
  activity,
  bagItems,
  feedback,
  profiles,
  sessions,
  tripMembers,
  users,
} from '../db/schema';
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

/**
 * The user with this email, or a new one who hasn't signed in yet: a user and profile with the
 * email as their name and no way to sign in. When they first sign in with Google with that
 * email, Better Auth links the Google account to this user and their name replaces the email
 * (src/auth.ts), so they find the trips and expenses they were added to.
 */
export async function userForEmail(tx: Executor, email: string) {
  const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) return existing.id;
  const [user] = await tx
    .insert(users)
    .values({ name: email, email, emailVerified: false, isAnonymous: false })
    .returning({ id: users.id });
  await insertProfile(tx, {
    id: user!.id,
    displayName: email,
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!,
    awaitingName: true,
  });
  return user!.id;
}

/**
 * A person added by email signed in, bringing their name: it replaces their email in their
 * profile and wherever a trip still shows it. Anyone else is left as is.
 */
export async function takeSignInName(db: Db, userId: string, name: string) {
  const trimmed = name.trim().slice(0, 50);
  if (!trimmed) return;
  await transact(db, async (tx) => {
    const profile = await findProfile(tx, userId);
    if (!profile?.awaitingName || profile.displayName === trimmed) return;
    await tx
      .update(tripMembers)
      .set({ displayName: trimmed })
      .where(and(eq(tripMembers.userId, userId), eq(tripMembers.displayName, profile.displayName)));
    await updateProfile(tx, userId, { displayName: trimmed, awaitingName: null });
  });
}

/** The user's name as they set it in their profile. */
export const displayNameOf = async (tx: Executor, user: { id: string; name: string }) =>
  (await findProfile(tx, user.id))?.displayName ?? user.name;

/** Tables keyed by (something, user_id): where both users have a row, the account's wins. */
const USER_KEYED = [
  ['trip_members', 'trip_id'],
  ['claims', 'item_id'],
  ['expense_shares', 'expense_id'],
  ['expense_part_shares', 'part_id'],
] as const;

/** Every column that references a profile. */
const USER_COLUMNS = [
  ['trips', 'created_by'],
  ['trip_members', 'user_id'],
  ['items', 'created_by'],
  ['claims', 'user_id'],
  ['claims', 'assigned_by'],
  ['expenses', 'paid_by'],
  ['expenses', 'created_by'],
  ['expense_shares', 'user_id'],
  ['expense_part_shares', 'user_id'],
  ['payments', 'from_user'],
  ['payments', 'to_user'],
  ['activity', 'actor'],
  ['feedback', 'user_id'],
  ['shopping_runs', 'shopper_id'],
  ['bag_items', 'user_id'],
] as const;

/** The user's trips, as their home screen lists them: none, and the account can be deleted. */
export async function countActiveTrips(tx: Executor, userId: string) {
  const [row] = await tx
    .select({ n: count() })
    .from(tripMembers)
    .where(and(eq(tripMembers.userId, userId), eq(tripMembers.status, 'active')));
  return row?.n ?? 0;
}

/** Stands in for a deleted user's name wherever their rows stay (see deleteUser). */
export const DELETED_NAME = 'חשבון שנמחק';

/**
 * Deletes the user: profile, Better Auth user (its sessions and accounts cascade), feedback, bag
 * and requests to join trips. The caller checks they're in no trip. Rows in trips they were removed
 * from (what they brought, paid, were paid) are the other members' history, so they stay; then
 * the user and profile stay too, as rows with no personal data, and their name in those trips
 * becomes DELETED_NAME. Returns their photo's key, for the caller to delete once committed.
 */
export async function deleteUser(tx: Executor, userId: string) {
  const id = sql.identifier;
  const photo = (await findProfile(tx, userId))?.avatarKey ?? undefined;
  await tx.delete(feedback).where(eq(feedback.userId, userId));
  await tx.delete(bagItems).where(eq(bagItems.userId, userId));
  // A request to join is all they did in that trip: it goes, with its log entry.
  const pending = await tx
    .delete(tripMembers)
    .where(and(eq(tripMembers.userId, userId), eq(tripMembers.status, 'pending')))
    .returning({ tripId: tripMembers.tripId });
  if (pending.length > 0) {
    await tx.delete(activity).where(
      and(
        eq(activity.actor, userId),
        inArray(
          activity.tripId,
          pending.map((p) => p.tripId),
        ),
      ),
    );
  }

  let referenced = false;
  for (const [table, column] of USER_COLUMNS) {
    const rows = await tx.execute(
      sql`select 1 from ${id(table)} where ${id(column)} = ${userId} limit 1`,
    );
    if (rows.length > 0) referenced = true;
  }
  if (!referenced) {
    await tx.delete(profiles).where(eq(profiles.id, userId));
    await tx.delete(users).where(eq(users.id, userId));
    return photo;
  }

  await tx
    .update(tripMembers)
    .set({ displayName: DELETED_NAME })
    .where(eq(tripMembers.userId, userId));
  await updateProfile(tx, userId, {
    displayName: DELETED_NAME,
    avatarKey: null,
    paymentPhone: null,
  });
  await tx
    .update(users)
    .set({
      name: DELETED_NAME,
      // Unique, and no one's: signing in with the same Google account makes a new user.
      email: `deleted-${userId}@deleted.invalid`,
      emailVerified: false,
      image: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
  await tx.delete(sessions).where(eq(sessions.userId, userId));
  await tx.delete(accounts).where(eq(accounts.userId, userId));
  return photo;
}

/**
 * Moves everything of user `from` to user `to` and deletes `from`'s profile. `to` keeps its own
 * photo, else takes `from`'s. Returns the key of `from`'s photo if `to` kept its own, for the
 * caller to delete once this has committed.
 */
export async function mergeUser(db: Db, from: string, to: string) {
  const id = sql.identifier;
  return transact(db, async (tx) => {
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
    // One active shopping run per shopper and trip: where both have one, `from`'s claims join
    // the account's run and `from`'s run ends.
    await tx.execute(sql`
      update claims c set run_id = b.id
      from shopping_runs a, shopping_runs b
      where c.run_id = a.id and a.shopper_id = ${from} and a.active
        and b.trip_id = a.trip_id and b.shopper_id = ${to} and b.active`);
    await tx.execute(sql`
      update shopping_runs a set status = 'cancelled', active = null, finished_at = now()
      where a.shopper_id = ${from} and a.active and exists (
        select 1 from shopping_runs b
        where b.trip_id = a.trip_id and b.shopper_id = ${to} and b.active)`);
    // The account's bag keeps its own row for a name both bags hold.
    await tx.execute(sql`
      delete from bag_items a where a.user_id = ${from} and exists (
        select 1 from bag_items b
        where b.user_id = ${to} and b.name = a.name and b.deleted_at is null)`);
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
    const [guest, account] = await Promise.all([findProfile(tx, from), findProfile(tx, to)]);
    const photo = guest?.avatarKey;
    if (photo && !account?.avatarKey) await updateProfile(tx, to, { avatarKey: photo });
    await tx.delete(profiles).where(eq(profiles.id, from));
    return account?.avatarKey ? (photo ?? undefined) : undefined;
  });
}
