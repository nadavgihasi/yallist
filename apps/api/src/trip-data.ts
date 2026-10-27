import {
  activeMemberIds,
  balances,
  coverFor,
  suggestTransfers,
  type Category,
  type Expense,
  type Item,
  type Member,
  type Payment,
} from '@yallist/domain';

import type { expenses, items, tripCategories, trips } from './db/schema';

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
    // Absent only on a trip the previous API version wrote mid-deploy, until the backfill.
    cover: row.cover ?? coverFor(row.template),
    status: row.status,
    requireApproval: row.requireApproval,
    meetupText: opt(row.meetupText),
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
  return { id: row.id, list: row.list, name: row.name, position: row.position };
}

export function toExpense(
  row: typeof expenses.$inferSelect,
  shares: string[],
  itemIds: string[],
): Expense {
  return {
    id: row.id,
    itemIds,
    description: row.description,
    amountAgorot: row.amountAgorot,
    paidBy: row.paidBy,
    shares,
    hasReceipt: row.receiptPath !== null,
  };
}

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
