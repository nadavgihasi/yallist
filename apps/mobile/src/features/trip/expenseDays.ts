import { owedShares, type Expense, type Payment } from '@yallist/domain';

import { he } from '@/i18n/he';
import { addDays, formatShort, spentDay } from '@/lib/dates';

export interface ExpenseDay<E, P = never> {
  /** `YYYY-MM-DD` */
  day: string;
  /** Newest first. */
  expenses: E[];
  /** Payments recorded that day, newest first: quiet rows that explain why balances moved. */
  payments: P[];
  /** The day's spending: expenses only, not payments. */
  totalAgorot: number;
}

/**
 * The money log by day, newest day first: each expense under the day it was spent (one dated
 * yesterday sorts under yesterday, whenever it was added), each payment under the day it was
 * recorded. Within a day, the one added last comes first.
 */
export function expenseDays<
  E extends Pick<Expense, 'amountAgorot' | 'spentOn' | 'createdAt'>,
  P extends Pick<Payment, 'createdAt'> = never,
>(expenses: readonly E[], payments: readonly P[] = []): ExpenseDay<E, P>[] {
  const days = new Map<string, { expenses: E[]; payments: P[] }>();
  const dayOf = (day: string) => {
    const found = days.get(day) ?? { expenses: [], payments: [] };
    days.set(day, found);
    return found;
  };
  for (const e of expenses) dayOf(spentDay(e)).expenses.push(e);
  for (const p of payments) dayOf(spentDay({ createdAt: p.createdAt })).payments.push(p);
  const newest = (a: { createdAt?: string }, b: { createdAt?: string }) =>
    (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
  return [...days]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, list]) => ({
      day,
      expenses: [...list.expenses].sort(newest),
      payments: [...list.payments].sort(newest),
      totalAgorot: list.expenses.reduce((sum, e) => sum + e.amountAgorot, 0),
    }));
}

/** What an expense does to my balance, for its row in the log. */
export type ExpenseEffect =
  /** I paid; the others' shares come back to me. */
  | { kind: 'lent'; amountAgorot: number }
  /** Someone else paid; this is my share of it. */
  | { kind: 'share'; amountAgorot: number }
  /** I paid it all for myself. */
  | { kind: 'own' }
  /** I'm not in it. */
  | { kind: 'none' };

export function expenseEffect(
  expense: Pick<Expense, 'amountAgorot' | 'paidBy' | 'shares' | 'parts' | 'weights'>,
  me: string,
): ExpenseEffect {
  const mine = owedShares(expense).get(me) ?? 0;
  if (expense.paidBy === me) {
    const lent = expense.amountAgorot - mine;
    return lent > 0 ? { kind: 'lent', amountAgorot: lent } : { kind: 'own' };
  }
  return mine > 0 ? { kind: 'share', amountAgorot: mine } : { kind: 'none' };
}

/** `היום · שבת 14.11`, `אתמול · שישי 13.11`, else `רביעי, 11.11`. */
export function dayLabel(day: string, today: string): string {
  if (day === today) return he.money.today(formatShort(day));
  if (day === addDays(today, -1)) return he.money.yesterday(formatShort(day));
  return formatShort(day);
}
