import { owedShares, type Expense, type Item } from '@yallist/domain';

/**
 * What each person owes for the expense, adding up to its amount: me first, then the trip's
 * members in their order, then anyone else on it (someone who left).
 */
export function owedLines(
  expense: Pick<Expense, 'amountAgorot' | 'shares' | 'parts'>,
  memberIds: readonly string[],
  me: string,
): { userId: string; owed: number }[] {
  const owed = owedShares(expense);
  const rank = (id: string) => {
    if (id === me) return -1;
    const i = memberIds.indexOf(id);
    return i < 0 ? memberIds.length : i;
  };
  return [...owed]
    .filter(([, amount]) => amount > 0)
    .sort(([a], [b]) => rank(a) - rank(b) || (a < b ? -1 : 1))
    .map(([userId, amount]) => ({ userId, owed: amount }));
}

/** The buy items the expense covered, still on the list, and how many were deleted since. */
export function coveredItems(
  expense: Pick<Expense, 'itemIds' | 'itemCount'>,
  items: readonly Item[],
): { items: Item[]; deleted: number } {
  const ids = expense.itemIds ?? [];
  const covered = items.filter((i) => ids.includes(i.id));
  const count = Math.max(expense.itemCount ?? ids.length, ids.length);
  return { items: covered, deleted: count - covered.length };
}
