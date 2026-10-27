import {
  claimCap,
  withQuantity,
  type Claim,
  type CoverId,
  type ItemKind,
  type ListKind,
} from '@yallist/domain';

import type { TripData } from './types';

export interface NewItemInput {
  list: ListKind;
  name: string;
  kind: ItemKind;
  quantityNeeded: number;
  /** Null: uncategorized. */
  categoryId: string | null;
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
  /** Packs or unpacks my claim on the item. */
  | { type: 'setPacked'; itemId: string; packed: boolean }
  // `newCategory`: create a category of that name first, and put the item in it.
  | { type: 'addItem'; item: NewItemInput; claim: number; newCategory?: string }
  | { type: 'deleteItem'; itemId: string }
  | { type: 'editItem'; itemId: string; changes: NewItemInput; newCategory?: string }
  | { type: 'addCategory'; list: ListKind; name: string }
  | { type: 'renameCategory'; categoryId: string; name: string }
  | { type: 'reorderCategories'; list: ListKind; categoryIds: string[] }
  | { type: 'deleteCategory'; categoryId: string }
  | { type: 'setNote'; itemId: string; note: string }
  // `receipt`: a local photo (`pickReceipt`) to upload once the expense exists.
  | { type: 'addExpense'; expense: NewExpenseInput; receipt?: string }
  | { type: 'deleteExpense'; expenseId: string }
  | { type: 'deleteReceipt'; expenseId: string }
  /** `fromUser` (default: me) is for a former member's payment, which the receiver records. */
  | { type: 'markPayment'; toUser: string; amountAgorot: number; fromUser?: string }
  | { type: 'deletePayment'; paymentId: string }
  | { type: 'confirmPayment'; paymentId: string }
  | { type: 'approveMember' | 'declineMember' | 'removeMember'; userId: string }
  | { type: 'setCover'; cover: CoverId }
  // Shopping runs (PACKING_SHOPPING_SPEC §4). Starting one needs the server's answer (the run's
  // id, what was skipped); the rest show at once and queue offline like any other change.
  | { type: 'startRun'; itemIds: string[] }
  | { type: 'addToRun'; runId: string; itemId: string }
  | { type: 'setInCart'; itemId: string; inCart: boolean }
  // `receipt`: a local photo to upload once the expense exists, as for addExpense.
  | { type: 'finishRun'; runId: string; amountAgorot: number; shares: string[]; receipt?: string }
  | { type: 'cancelRun'; runId: string };

/**
 * The trip as it will be once the API accepts `action`, shown right away (optimistic update).
 * Changes that need a server-made id (new items, categories, expenses, payments) wait for the API
 * instead.
 */
export function applyAction(data: TripData, action: Action, me: string): TripData {
  switch (action.type) {
    case 'setClaim': {
      const item = data.items.find((i) => i.id === action.itemId);
      if (!item) return data;
      // Same cap the server enforces: never claim past what's still needed.
      const quantity = Math.min(action.quantity, claimCap(item, data.claims, me));
      const isMine = (c: Claim) => c.itemId === action.itemId && c.userId === me;
      const others = data.claims.filter((c) => !isMine(c));
      const mine = data.claims.find(isMine) ?? { itemId: action.itemId, userId: me, quantity: 0 };
      return {
        ...data,
        // Claiming more unpacks it, as the API does.
        claims: quantity > 0 ? [...others, withQuantity(mine, quantity)] : others,
      };
    }
    case 'setPacked':
      return {
        ...data,
        claims: data.claims.map((c) =>
          c.itemId === action.itemId && c.userId === me ? { ...c, packed: action.packed } : c,
        ),
      };
    case 'deleteItem':
      return {
        ...data,
        items: data.items.filter((i) => i.id !== action.itemId),
        claims: data.claims.filter((c) => c.itemId !== action.itemId),
        expenses: data.expenses.map((e) => ({
          ...e,
          itemIds: e.itemIds?.filter((id) => id !== action.itemId),
        })),
      };
    case 'editItem': {
      const { changes, newCategory } = action;
      return {
        ...data,
        items: data.items.map((i) =>
          i.id === action.itemId
            ? {
                ...i,
                ...changes,
                // A new category has no id yet: the item stays where it is until the API answers.
                categoryId: newCategory ? i.categoryId : (changes.categoryId ?? undefined),
              }
            : i,
        ),
      };
    }
    case 'renameCategory':
      return {
        ...data,
        categories: data.categories.map((c) =>
          c.id === action.categoryId ? { ...c, name: action.name } : c,
        ),
      };
    case 'reorderCategories':
      return {
        ...data,
        categories: data.categories.map((c) => {
          const position = action.categoryIds.indexOf(c.id);
          return position < 0 ? c : { ...c, position };
        }),
      };
    case 'deleteCategory':
      return {
        ...data,
        categories: data.categories.filter((c) => c.id !== action.categoryId),
        items: data.items.map((i) =>
          i.categoryId === action.categoryId ? { ...i, categoryId: undefined } : i,
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
    case 'deleteReceipt':
      return {
        ...data,
        expenses: data.expenses.map((e) =>
          e.id === action.expenseId ? { ...e, hasReceipt: false } : e,
        ),
      };
    case 'deletePayment':
      return { ...data, payments: data.payments.filter((p) => p.id !== action.paymentId) };
    case 'confirmPayment':
      return {
        ...data,
        payments: data.payments.map((p) =>
          p.id === action.paymentId ? { ...p, status: 'confirmed' } : p,
        ),
      };
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
        // A removed member's claims are dropped and their run cancelled: what they took is
        // missing again.
        claims: data.claims.filter((c) => type !== 'removeMember' || c.userId !== userId),
        runs: data.runs.filter((r) => type !== 'removeMember' || r.shopperId !== userId),
      };
    }
    case 'setCover':
      return { ...data, trip: { ...data.trip, cover: action.cover } };
    case 'addToRun': {
      const item = data.items.find((i) => i.id === action.itemId);
      if (!item || data.claims.some((c) => c.itemId === item.id)) return data;
      const claim = { itemId: item.id, userId: me, quantity: item.quantityNeeded };
      return { ...data, claims: [...data.claims, { ...claim, runId: action.runId }] };
    }
    case 'setInCart':
      return {
        ...data,
        claims: data.claims.map((c) =>
          c.itemId === action.itemId && c.userId === me && c.runId
            ? { ...c, inCart: action.inCart || undefined }
            : c,
        ),
      };
    // What isn't in the cart goes back to the list at once. The run stays until the API answers
    // (labelled as waiting while offline): the purchase needs the server's expense.
    case 'finishRun':
      return {
        ...data,
        claims: data.claims.filter((c) => c.runId !== action.runId || c.inCart),
      };
    case 'cancelRun':
      return {
        ...data,
        claims: data.claims.filter((c) => c.runId !== action.runId),
        runs: data.runs.filter((r) => r.id !== action.runId),
      };
    default:
      return data;
  }
}
