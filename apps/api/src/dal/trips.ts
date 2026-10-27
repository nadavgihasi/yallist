import type { Claim, Payment } from '@yallist/domain';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import { fail } from '../access';
import { avatarUrl } from '../avatars';
import {
  activity,
  claims,
  expenseItems,
  expenseShares,
  expenses,
  items,
  payments,
  profiles,
  shoppingRuns,
  tripCategories,
  tripMembers,
  trips,
  users,
} from '../db/schema';
import type { Executor, Tx } from '../db/tx';
import type { ReceiptStore } from '../receipts';
import { toCategory, toExpense, toItem, toTrip } from '../trip-data';
import { listCategories } from './categories';
import { visibleTo } from './items';

export async function insertTrip(tx: Executor, values: typeof trips.$inferInsert) {
  const [trip] = await tx.insert(trips).values(values).returning();
  return trip!;
}

export async function setTrip(
  tx: Executor,
  tripId: string,
  changes: Partial<Omit<typeof trips.$inferInsert, 'id' | 'updatedAt'>>,
) {
  const [trip] = await tx
    .update(trips)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(trips.id, tripId))
    .returning();
  return trip!;
}

/** Locks the trip row, serializing writes that must see every other one (organizer counts). */
export async function lockTrip(tx: Tx, tripId: string) {
  const [trip] = await tx.select().from(trips).where(eq(trips.id, tripId)).for('update');
  if (!trip) throw fail(404, 'Trip not found');
  return trip;
}

/** Deletes up to `limit` of the trip's oldest activity rows; returns how many it deleted. */
export async function deleteActivity(tx: Executor, tripId: string, limit: number) {
  const rows = await tx
    .select({ id: activity.id })
    .from(activity)
    .where(eq(activity.tripId, tripId))
    .limit(limit);
  if (rows.length === 0) return 0;
  const ids = rows.map((r) => r.id);
  await tx.delete(activity).where(inArray(activity.id, ids));
  return ids.length;
}

/**
 * Deletes the trip and everything in it, children first (no cascades on DSQL). Returns the
 * receipt keys its expenses had, for the caller to delete from storage once this commits.
 */
export async function deleteTrip(tx: Executor, tripId: string) {
  const tripItems = tx.select({ id: items.id }).from(items).where(eq(items.tripId, tripId));
  const tripExpenses = tx
    .select({ id: expenses.id })
    .from(expenses)
    .where(eq(expenses.tripId, tripId));
  await tx.delete(claims).where(inArray(claims.itemId, tripItems));
  // Runs after the claims that point at them; runs and purchased items before the expenses.
  await tx.delete(shoppingRuns).where(eq(shoppingRuns.tripId, tripId));
  await tx.delete(expenseItems).where(inArray(expenseItems.expenseId, tripExpenses));
  await tx.delete(expenseShares).where(inArray(expenseShares.expenseId, tripExpenses));
  const deleted = await tx
    .delete(expenses)
    .where(eq(expenses.tripId, tripId))
    .returning({ receiptPath: expenses.receiptPath });
  await tx.delete(payments).where(eq(payments.tripId, tripId));
  // Items after their purchases, categories after their items.
  await tx.delete(items).where(eq(items.tripId, tripId));
  await tx.delete(tripCategories).where(eq(tripCategories.tripId, tripId));
  await tx.delete(activity).where(eq(activity.tripId, tripId));
  await tx.delete(tripMembers).where(eq(tripMembers.tripId, tripId));
  await tx.delete(trips).where(eq(trips.id, tripId));
  return deleted.flatMap((e) => (e.receiptPath ? [e.receiptPath] : []));
}

export async function tripByToken(tx: Executor, token: string) {
  const [trip] = await tx.select().from(trips).where(eq(trips.inviteToken, token));
  // Unknown and rotated tokens look the same.
  if (!trip) throw fail(404, 'Invite not found');
  return trip;
}

/**
 * Everything about the given trips that the app's trip screens need, in one snapshot, as
 * `viewer` sees it: their own private items (and claims on them) apart in `privateItems`, and
 * nobody else's. Null: no one's (the public invite preview). With `photos`, for a viewer who is
 * an active member of every one of them, active members come with their avatar's URL: only
 * trip-mates see someone's photo.
 */
export async function loadTrips(
  tx: Executor,
  tripIds: string[],
  viewer: string | null,
  photos?: ReceiptStore,
) {
  if (tripIds.length === 0) return [];
  const [
    tripRows,
    memberRows,
    categoryRows,
    itemRows,
    claimRows,
    expenseRows,
    shareRows,
    purchaseRows,
    paymentRows,
    runRows,
  ] = await Promise.all([
    tx.select().from(trips).where(inArray(trips.id, tripIds)),
    tx
      .select({
        tripId: tripMembers.tripId,
        userId: tripMembers.userId,
        displayName: tripMembers.displayName,
        role: tripMembers.role,
        status: tripMembers.status,
        color: profiles.avatarColor,
        avatarKey: profiles.avatarKey,
        image: users.image,
      })
      .from(tripMembers)
      .innerJoin(profiles, eq(profiles.id, tripMembers.userId))
      .innerJoin(users, eq(users.id, tripMembers.userId))
      .where(inArray(tripMembers.tripId, tripIds))
      .orderBy(asc(tripMembers.joinedAt)),
    listCategories(tx, tripIds),
    tx
      .select()
      .from(items)
      .where(and(inArray(items.tripId, tripIds), isNull(items.deletedAt), visibleTo(viewer)))
      .orderBy(asc(items.list), asc(items.position)),
    tx
      .select({ tripId: items.tripId, claim: claims })
      .from(claims)
      .innerJoin(items, eq(items.id, claims.itemId))
      .where(and(inArray(items.tripId, tripIds), isNull(items.deletedAt), visibleTo(viewer))),
    tx
      .select()
      .from(expenses)
      .where(inArray(expenses.tripId, tripIds))
      .orderBy(asc(expenses.createdAt)),
    tx
      .select({ expenseId: expenseShares.expenseId, userId: expenseShares.userId })
      .from(expenseShares)
      .innerJoin(expenses, eq(expenses.id, expenseShares.expenseId))
      .where(inArray(expenses.tripId, tripIds)),
    // A purchase of an item that was since deleted no longer marks anything bought.
    tx
      .select({ expenseId: expenseItems.expenseId, itemId: expenseItems.itemId })
      .from(expenseItems)
      .innerJoin(items, eq(items.id, expenseItems.itemId))
      .where(and(inArray(items.tripId, tripIds), isNull(items.deletedAt))),
    tx
      .select()
      .from(payments)
      .where(inArray(payments.tripId, tripIds))
      .orderBy(asc(payments.markedAt)),
    tx
      .select()
      .from(shoppingRuns)
      .where(and(inArray(shoppingRuns.tripId, tripIds), eq(shoppingRuns.status, 'active')))
      .orderBy(asc(shoppingRuns.startedAt)),
  ]);

  const avatars = new Map<string, string | undefined>();
  if (photos) {
    const active = memberRows.filter((m) => m.status === 'active');
    const urls = await Promise.all(active.map((m) => avatarUrl(photos, m)));
    active.forEach((m, i) => avatars.set(m.userId, urls[i]));
  }
  return tripRows.map((trip) => ({
    trip: toTrip(trip),
    inviteToken: trip.inviteToken,
    members: memberRows
      .filter((m) => m.tripId === trip.id)
      .map(
        ({
          tripId: _,
          avatarKey: _k,
          image: _i,
          ...member
        }): typeof member & {
          avatarUrl?: string;
        } => ({
          ...member,
          avatarUrl: member.status === 'active' ? avatars.get(member.userId) : undefined,
        }),
      ),
    categories: categoryRows.filter((c) => c.tripId === trip.id).map(toCategory),
    items: itemRows.filter((i) => i.tripId === trip.id && !i.privateOwnerId).map(toItem),
    /** The viewer's own private items (their bag's "רק שלי"); counted nowhere. */
    privateItems: itemRows.filter((i) => i.tripId === trip.id && i.privateOwnerId).map(toItem),
    claims: claimRows
      .filter((c) => c.tripId === trip.id)
      .map(({ claim }): Claim => ({
        itemId: claim.itemId,
        userId: claim.userId,
        quantity: claim.quantity,
        arrived: claim.arrivedAt !== null,
        runId: claim.runId ?? undefined,
        inCart: claim.inCartAt ? true : undefined,
        packed: claim.packedAt !== null,
      })),
    expenses: expenseRows
      .filter((e) => e.tripId === trip.id)
      .map((e) =>
        toExpense(
          e,
          shareRows.filter((s) => s.expenseId === e.id).map((s) => s.userId),
          purchaseRows.filter((p) => p.expenseId === e.id).map((p) => p.itemId),
        ),
      ),
    payments: paymentRows
      .filter((p) => p.tripId === trip.id)
      .map((p): Payment => ({
        id: p.id,
        fromUser: p.fromUser,
        toUser: p.toUser,
        amountAgorot: p.amountAgorot,
        status: p.status,
      })),
    /** Who is out shopping right now (active runs only). */
    runs: runRows
      .filter((r) => r.tripId === trip.id)
      .map((r) => ({ id: r.id, shopperId: r.shopperId, startedAt: r.startedAt.toISOString() })),
  }));
}
