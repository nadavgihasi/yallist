import {
  activeMemberIds,
  balances,
  suggestTransfers,
  type Expense,
  type Item,
  type Member,
  type Payment,
} from '@yallist/domain';

import type { expenses, items, trips } from './db/schema';

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

export function toExpense(row: typeof expenses.$inferSelect, shares: string[]): Expense {
  return {
    id: row.id,
    itemId: opt(row.itemId),
    description: row.description,
    amountAgorot: row.amountAgorot,
    paidBy: row.paidBy,
    shares,
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
