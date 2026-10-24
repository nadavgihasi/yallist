import { claimCap, type ItemKind, type ListKind } from '@yallist/domain';

import type { TripData } from './types';

export interface NewItemInput {
  list: ListKind;
  name: string;
  kind: ItemKind;
  quantityNeeded: number;
  category: string;
}

export interface NewExpenseInput {
  description: string;
  amountAgorot: number;
  paidBy: string;
  shares: string[];
  itemId?: string;
}

/** A change to a trip, sent to the API by `useTripAction`. */
export type Action =
  | { type: 'setClaim'; itemId: string; quantity: number }
  | { type: 'addItem'; item: NewItemInput; claim: number }
  | { type: 'deleteItem'; itemId: string }
  | { type: 'setNote'; itemId: string; note: string }
  | { type: 'addExpense'; expense: NewExpenseInput }
  | { type: 'deleteExpense'; expenseId: string }
  | { type: 'markPayment'; toUser: string; amountAgorot: number }
  | { type: 'deletePayment'; paymentId: string }
  | { type: 'approveMember' | 'declineMember' | 'removeMember'; userId: string };

/**
 * The trip as it will be once the API accepts `action`, shown right away (optimistic update).
 * Changes that need a server-made id (new items, expenses, payments) wait for the API instead.
 */
export function applyAction(data: TripData, action: Action, me: string): TripData {
  switch (action.type) {
    case 'setClaim': {
      const item = data.items.find((i) => i.id === action.itemId);
      if (!item) return data;
      // Same cap the server enforces: never claim past what's still needed.
      const quantity = Math.min(action.quantity, claimCap(item, data.claims, me));
      const others = data.claims.filter((c) => !(c.itemId === action.itemId && c.userId === me));
      return {
        ...data,
        claims:
          quantity > 0 ? [...others, { itemId: action.itemId, userId: me, quantity }] : others,
      };
    }
    case 'deleteItem':
      return {
        ...data,
        items: data.items.filter((i) => i.id !== action.itemId),
        claims: data.claims.filter((c) => c.itemId !== action.itemId),
        expenses: data.expenses.map((e) =>
          e.itemId === action.itemId ? { ...e, itemId: undefined } : e,
        ),
      };
    case 'setNote':
      return {
        ...data,
        items: data.items.map((i) =>
          i.id === action.itemId ? { ...i, note: action.note || undefined } : i,
        ),
      };
    case 'deleteExpense':
      return { ...data, expenses: data.expenses.filter((e) => e.id !== action.expenseId) };
    case 'deletePayment':
      return { ...data, payments: data.payments.filter((p) => p.id !== action.paymentId) };
    case 'approveMember':
    case 'declineMember':
    case 'removeMember': {
      const { type, userId } = action;
      return {
        ...data,
        members: data.members.map((m) =>
          m.userId === userId
            ? { ...m, status: type === 'approveMember' ? 'active' : 'removed' }
            : m,
        ),
        // A removed member's claims are dropped: what they took is missing again.
        claims: data.claims.filter((c) => type !== 'removeMember' || c.userId !== userId),
      };
    }
    default:
      return data;
  }
}
