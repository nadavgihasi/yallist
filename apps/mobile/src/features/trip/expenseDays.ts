import type { Expense } from '@yallist/domain';

import { he } from '@/i18n/he';
import { addDays, formatShort, spentDay } from '@/lib/dates';

export interface ExpenseDay<E> {
  /** `YYYY-MM-DD` */
  day: string;
  /** Newest first. */
  expenses: E[];
  totalAgorot: number;
}

/**
 * The expense log by the day each was spent, newest day first; within a day, the one added last
 * first. An expense dated yesterday sorts under yesterday, whenever it was added.
 */
export function expenseDays<E extends Pick<Expense, 'amountAgorot' | 'spentOn' | 'createdAt'>>(
  expenses: readonly E[],
): ExpenseDay<E>[] {
  const byDay = new Map<string, E[]>();
  for (const e of expenses) {
    const day = spentDay(e);
    byDay.set(day, [...(byDay.get(day) ?? []), e]);
  }
  return [...byDay]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, list]) => ({
      day,
      expenses: [...list].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
      totalAgorot: list.reduce((sum, e) => sum + e.amountAgorot, 0),
    }));
}

/** `היום · שבת 14.11`, `אתמול · שישי 13.11`, else `רביעי, 11.11`. */
export function dayLabel(day: string, today: string): string {
  if (day === today) return he.money.today(formatShort(day));
  if (day === addDays(today, -1)) return he.money.yesterday(formatShort(day));
  return formatShort(day);
}
