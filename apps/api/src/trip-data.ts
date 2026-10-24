import type { Claim, Expense, Item, Payment } from '@yallist/domain';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import {
  claims,
  expenseShares,
  expenses,
  items,
  payments,
  profiles,
  tripMembers,
  trips,
} from './db/schema';
import type { Tx } from './db/tx';

// The shapes the app already works with (apps/mobile/src/state/types.ts, @yallist/domain).
// Nullable columns become absent fields rather than nulls.

const opt = <T>(value: T | null) => value ?? undefined;

export function toTrip(row: typeof trips.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    placeText: opt(row.placeText),
    template: row.template,
    status: row.status,
    requireApproval: row.requireApproval,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toItem(row: typeof items.$inferSelect): Item {
  return {
    id: row.id,
    list: row.list,
    category: row.category,
    position: row.position,
    name: row.name,
    kind: row.kind,
    quantityNeeded: row.quantityNeeded,
    unit: opt(row.unit),
    displayQty: opt(row.displayQty),
    note: opt(row.note),
  };
}

/** Everything about the given trips that the app's trip screens need, in one snapshot. */
export async function loadTrips(tx: Tx, tripIds: string[]) {
  if (tripIds.length === 0) return [];
  const [tripRows, memberRows, itemRows, claimRows, expenseRows, shareRows, paymentRows] =
    await Promise.all([
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
      .map((e): Expense => ({
        id: e.id,
        // A purchase of an item that was since deleted no longer marks anything bought.
        itemId: e.itemId && liveItems.has(e.itemId) ? e.itemId : undefined,
        description: e.description,
        amountAgorot: e.amountAgorot,
        paidBy: e.paidBy,
        shares: shareRows.filter((s) => s.expenseId === e.id).map((s) => s.userId),
      })),
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

export type TripData = Awaited<ReturnType<typeof loadTrips>>[number];
