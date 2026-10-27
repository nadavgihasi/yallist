import { claimsFor, linkedExpense } from './coverage';
import { splitEqually } from './money';
import type { Claim, Expense, Item } from './types';

/**
 * What a shopping run can claim: a shared buy item nobody claimed that isn't bought yet. Not an
 * `each` item: everyone buys their own, so it is never part of one shared expense.
 */
export function isRunEligible(
  item: Item,
  claims: readonly Claim[],
  expenses: readonly Expense[],
): boolean {
  return (
    item.list === 'buy' &&
    item.kind !== 'each' &&
    !item.privateOwnerId &&
    claimsFor(item.id, claims).length === 0 &&
    !linkedExpense(item.id, expenses)
  );
}

/**
 * A run's items (`claims`: the run's claims), split by whether they are in the cart, in list
 * order. Items no longer on the list (deleted) drop out.
 */
export function runSummary(
  claims: readonly Claim[],
  items: readonly Item[],
): { inCart: Item[]; notInCart: Item[] } {
  const inRun = new Map(claims.map((c) => [c.itemId, c]));
  const runItems = items.filter((i) => inRun.has(i.id)).sort((a, b) => a.position - b.position);
  return {
    inCart: runItems.filter((i) => inRun.get(i.id)!.inCart),
    notInCart: runItems.filter((i) => !inRun.get(i.id)!.inCart),
  };
}

/**
 * What each person pays when `amountAgorot` is split equally between `shareCount` people: the
 * largest share of `splitEqually`, so the preview never shows less than anyone pays.
 */
export function perPersonPreview(amountAgorot: number, shareCount: number): number | undefined {
  if (shareCount <= 0 || amountAgorot <= 0) return undefined;
  const ids = Array.from({ length: shareCount }, (_, i) => String(i));
  return Math.max(...splitEqually(amountAgorot, ids).values());
}
