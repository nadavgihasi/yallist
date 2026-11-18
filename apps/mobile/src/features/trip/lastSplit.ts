import type { Expense } from '@yallist/domain';

/**
 * Who shared the last expense I added to this trip, still in it: where a new expense's split
 * starts, as the group usually splits the same way. Undefined when I haven't added one, or
 * nobody from it is left.
 */
export function lastSplit(
  expenses: readonly Pick<Expense, 'createdBy' | 'createdAt' | 'shares'>[],
  me: string,
  activeIds: readonly string[],
): string[] | undefined {
  const mine = expenses
    .filter((e) => e.createdBy === me)
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
    .at(-1);
  const shares = mine?.shares.filter((id) => activeIds.includes(id));
  return shares && shares.length > 0 ? shares : undefined;
}
