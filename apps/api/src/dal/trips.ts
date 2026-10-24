import type { Claim, Payment } from '@yallist/domain';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import { fail } from '../access';
import {
  claims,
  expenseShares,
  expenses,
  items,
  payments,
  profiles,
  tripMembers,
  trips,
} from '../db/schema';
import type { Executor, Tx } from '../db/tx';
import { toCategory, toExpense, toItem, toTrip } from '../trip-data';
import { listCategories } from './categories';

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

export async function tripByToken(tx: Executor, token: string) {
  const [trip] = await tx.select().from(trips).where(eq(trips.inviteToken, token));
  // Unknown and rotated tokens look the same.
  if (!trip) throw fail(404, 'Invite not found');
  return trip;
}

/** Everything about the given trips that the app's trip screens need, in one snapshot. */
export async function loadTrips(tx: Executor, tripIds: string[]) {
  if (tripIds.length === 0) return [];
  const [
    tripRows,
    memberRows,
    categoryRows,
    itemRows,
    claimRows,
    expenseRows,
    shareRows,
    paymentRows,
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
      })
      .from(tripMembers)
      .innerJoin(profiles, eq(profiles.id, tripMembers.userId))
      .where(inArray(tripMembers.tripId, tripIds))
      .orderBy(asc(tripMembers.joinedAt)),
    listCategories(tx, tripIds),
    tx
      .select()
      .from(items)
      .where(and(inArray(items.tripId, tripIds), isNull(items.deletedAt)))
      .orderBy(asc(items.list), asc(items.position)),
    tx
      .select({ tripId: items.tripId, claim: claims })
      .from(claims)
      .innerJoin(items, eq(items.id, claims.itemId))
      .where(and(inArray(items.tripId, tripIds), isNull(items.deletedAt))),
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
    tx
      .select()
      .from(payments)
      .where(inArray(payments.tripId, tripIds))
      .orderBy(asc(payments.markedAt)),
  ]);

  const liveItems = new Set(itemRows.map((i) => i.id));
  return tripRows.map((trip) => ({
    trip: toTrip(trip),
    inviteToken: trip.inviteToken,
    members: memberRows
      .filter((m) => m.tripId === trip.id)
      .map(({ tripId: _, ...member }) => member),
    categories: categoryRows.filter((c) => c.tripId === trip.id).map(toCategory),
    items: itemRows.filter((i) => i.tripId === trip.id).map(toItem),
    claims: claimRows
      .filter((c) => c.tripId === trip.id)
      .map(({ claim }): Claim => ({
        itemId: claim.itemId,
        userId: claim.userId,
        quantity: claim.quantity,
        arrived: claim.arrivedAt !== null,
      })),
    expenses: expenseRows
      .filter((e) => e.tripId === trip.id)
      .map((e) =>
        toExpense(
          // A purchase of an item that was since deleted no longer marks anything bought.
          { ...e, itemId: e.itemId && liveItems.has(e.itemId) ? e.itemId : null },
          shareRows.filter((s) => s.expenseId === e.id).map((s) => s.userId),
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
  }));
}
