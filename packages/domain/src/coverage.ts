import type { Claim, Expense, Item, Member } from './types';

export function activeMemberIds(members: readonly Member[]): string[] {
  return members.filter((m) => m.status === 'active').map((m) => m.userId);
}

export function claimsFor(itemId: string, claims: readonly Claim[]): Claim[] {
  return claims.filter((c) => c.itemId === itemId);
}

export function claimedQuantity(itemId: string, claims: readonly Claim[]): number {
  return claimsFor(itemId, claims).reduce((sum, c) => sum + c.quantity, 0);
}

/** Who still needs to tick an `each` item. */
export function missingForEach(
  item: Item,
  claims: readonly Claim[],
  activeIds: readonly string[],
): string[] {
  const have = new Set(claimsFor(item.id, claims).map((c) => c.userId));
  return activeIds.filter((id) => !have.has(id));
}

export function isCovered(item: Item, claims: readonly Claim[], activeIds: readonly string[]) {
  if (item.kind === 'each') return missingForEach(item, claims, activeIds).length === 0;
  return claimedQuantity(item.id, claims) >= item.quantityNeeded;
}

export function linkedExpense(itemId: string, expenses: readonly Expense[]): Expense | undefined {
  return expenses.find((e) => e.itemIds?.includes(itemId));
}

export type ItemStatus =
  | { kind: 'missing' }
  | { kind: 'partial'; missing: number }
  | { kind: 'each'; have: number; total: number; missingIds: string[] }
  | { kind: 'mine' }
  | { kind: 'covered'; holderIds: string[] }
  | { kind: 'inProgress'; holderIds: string[] }
  | { kind: 'bought'; expense: Expense };

/** The status line shown for an item row (SPEC §4). */
export function itemStatus(
  item: Item,
  claims: readonly Claim[],
  expenses: readonly Expense[],
  activeIds: readonly string[],
  me: string,
): ItemStatus {
  if (item.list === 'buy') {
    const expense = linkedExpense(item.id, expenses);
    if (expense) return { kind: 'bought', expense };
  }
  const itemClaims = claimsFor(item.id, claims);
  if (item.kind === 'each') {
    const missingIds = missingForEach(item, claims, activeIds);
    if (missingIds.length > 0) {
      return {
        kind: 'each',
        have: activeIds.length - missingIds.length,
        total: activeIds.length,
        missingIds,
      };
    }
    return { kind: 'covered', holderIds: [] };
  }
  const claimed = claimedQuantity(item.id, claims);
  if (claimed === 0) return { kind: 'missing' };
  if (claimed < item.quantityNeeded)
    return { kind: 'partial', missing: item.quantityNeeded - claimed };
  const holderIds = itemClaims.map((c) => c.userId);
  if (item.kind === 'single' && holderIds.includes(me)) return { kind: 'mine' };
  return { kind: item.list === 'buy' ? 'inProgress' : 'covered', holderIds };
}

/**
 * "Done" for progress and missing counts: someone took it (covered) or it was bought.
 * A claimed-but-unbought buy item (`בטיפול`) is not missing, matching the TripV2 mockup.
 */
export function isDone(
  item: Item,
  claims: readonly Claim[],
  expenses: readonly Expense[],
  activeIds: readonly string[],
): boolean {
  if (item.list === 'buy' && linkedExpense(item.id, expenses)) return true;
  return isCovered(item, claims, activeIds);
}

export type ListFilter = 'all' | 'missing' | 'mine';

export function filterItems(
  items: readonly Item[],
  filter: ListFilter,
  claims: readonly Claim[],
  expenses: readonly Expense[],
  activeIds: readonly string[],
  me: string,
): Item[] {
  if (filter === 'all') return [...items];
  if (filter === 'missing') return items.filter((i) => !isDone(i, claims, expenses, activeIds));
  return items.filter((i) => isOnMyList(i, claims, me));
}

/**
 * What "אצלי" shows: what I took, and every "each" item, since everyone brings their own, even
 * before I mark that I have it.
 */
function isOnMyList(item: Item, claims: readonly Claim[], me: string): boolean {
  return item.kind === 'each' || claimsFor(item.id, claims).some((c) => c.userId === me);
}

/** Max quantity `userId` may claim, given everyone else's claims. */
export function claimCap(item: Item, claims: readonly Claim[], userId: string): number {
  if (item.kind === 'each') return 1;
  const others = claimsFor(item.id, claims)
    .filter((c) => c.userId !== userId)
    .reduce((sum, c) => sum + c.quantity, 0);
  return Math.max(0, item.quantityNeeded - others);
}
