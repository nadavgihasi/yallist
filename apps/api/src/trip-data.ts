import {
  activeMemberIds,
  balances,
  coverFor,
  suggestTransfers,
  type Category,
  type Expense,
  type ExpensePart,
  type Item,
  type Member,
  type Payment,
} from '@yallist/domain';

import type { expenses, items, payments, tripCategories, trips } from './db/schema';

// The shapes the app already works with (apps/mobile/src/state/types.ts, @yallist/domain).
// Nullable columns become absent fields rather than nulls.

const opt = <T>(value: T | null) => value ?? undefined;

export function toTrip(row: typeof trips.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    template: row.template,
    // Every trip has a cover; the column is only nullable (see trips.cover).
    cover: row.cover ?? coverFor(row.template),
    status: row.status,
    requireApproval: row.requireApproval,
    meetupText: opt(row.meetupText),
    meetupPoint:
      row.meetupLat !== null && row.meetupLng !== null
        ? { lat: row.meetupLat, lng: row.meetupLng }
        : undefined,
    albumUrl: opt(row.albumUrl),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toItem(row: typeof items.$inferSelect): Item {
  return {
    id: row.id,
    list: row.list,
    categoryId: opt(row.categoryId),
    position: row.position,
    name: row.name,
    kind: row.kind,
    quantityNeeded: row.quantityNeeded,
    unit: opt(row.unit),
    displayQty: opt(row.displayQty),
    note: opt(row.note),
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toCategory(row: typeof tripCategories.$inferSelect): Category {
  const category: Category = { id: row.id, list: row.list, name: row.name, position: row.position };
  if (row.color !== null) category.color = row.color;
  return category;
}

export function toExpense(
  row: typeof expenses.$inferSelect,
  shares: string[],
  itemIds: string[],
  /** Deleted items included: a run whose items were deleted is still a run. */
  itemCount = itemIds.length,
  parts: ExpensePart[] = [],
  /** Weights other than 1, by user id. */
  weights: Record<string, number> = {},
): Expense {
  return {
    id: row.id,
    itemIds,
    itemCount,
    description: row.description,
    amountAgorot: row.amountAgorot,
    paidBy: row.paidBy,
    createdBy: row.createdBy,
    shares,
    // Absent unless split in parts, as before parts existed.
    ...(parts.length > 0 && { parts }),
    ...(Object.keys(weights).length > 0 && { weights }),
    hasReceipt: row.receiptPath !== null,
    createdAt: row.createdAt.toISOString(),
    ...(row.spentOn && { spentOn: row.spentOn }),
  };
}

export const toPayment = (row: typeof payments.$inferSelect): Payment => ({
  id: row.id,
  fromUser: row.fromUser,
  toUser: row.toUser,
  amountAgorot: row.amountAgorot,
  // Before anyone could record a payment for others, the payer did.
  createdBy: row.createdBy ?? row.fromUser,
  createdAt: row.markedAt.toISOString(),
});

/** Who owes whom: balances (positive: the group owes them) and the transfers that settle them. */
export function settleUp({
  members,
  expenses,
  payments,
}: {
  members: Member[];
  expenses: Expense[];
  payments: Payment[];
}) {
  const balance = balances(activeMemberIds(members), expenses, payments);
  return { balances: Object.fromEntries(balance), transfers: suggestTransfers(balance) };
}
