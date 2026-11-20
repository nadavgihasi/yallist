import {
  formatShekel,
  owedShares,
  parseShekel,
  type Expense,
  type ExpensePart,
} from '@yallist/domain';

import { he } from '@/i18n/he';

/** As the API takes a part's label. */
const LABEL_MAX = 40;

export interface AmountSplit {
  /** Who shares what the parts leave: the last person with an amount, alone. */
  shares: string[];
  /** One part for each of the others, for that person alone. */
  parts: ExpensePart[];
  /** What each person pays, adding up to the total; empty until it's valid. */
  owed: Map<string, number>;
  /** The total less the amounts typed: positive while some is still unassigned. */
  left?: number;
  /** Why it can't be saved yet, if it can't. */
  error?: string;
}

/**
 * Splitwise's "exact amounts": each person's own amount, typed, adding up to the total. The API
 * keeps an expense's rest for `shares`, and wants something left for it, so all but the last of
 * them become a part for one person, and the last takes the rest.
 */
export function amountSplit(
  total: number | undefined,
  /** Each person's amount as typed, in `order`. */
  amounts: Readonly<Record<string, string>>,
  order: readonly string[],
  nameOf: (id: string) => string,
): AmountSplit {
  const typed = order.filter((id) => amounts[id]?.trim());
  const owed = new Map(typed.map((id) => [id, parseShekel(amounts[id]!) ?? 0]));
  const sum = [...owed.values()].reduce((s, v) => s + v, 0);
  const left = total && total - sum;
  const last = typed.at(-1);
  const parts = typed.slice(0, -1).map((id) => ({
    label: (nameOf(id).trim() || he.shop.finish.partDefault(1)).slice(0, LABEL_MAX),
    amountAgorot: owed.get(id)!,
    shares: [id],
  }));
  const shares = last ? [last] : [];
  const fail = (error: string): AmountSplit => ({ shares, parts, owed: new Map(), left, error });
  if (!total) return fail(he.item.enterAmount);
  if ([...owed.values()].some((v) => !v)) return fail(he.invalidAmount);
  if (!last) return fail(he.item.pickSomeone);
  if (left! > 0) return fail(he.addExpense.amountsLeft(formatShekel(left!)));
  if (left! < 0) return fail(he.addExpense.amountsOver(formatShekel(-left!)));
  return { shares, parts, owed, left };
}

/**
 * Each person's amount, when the expense was saved that way: every part for one person, each a
 * different one, and the rest for one more, by no weight. Undefined for any other split.
 */
export function byAmounts(
  expense: Pick<Expense, 'amountAgorot' | 'shares' | 'parts' | 'weights'>,
): Map<string, number> | undefined {
  const parts = expense.parts ?? [];
  if (parts.length === 0 || expense.shares.length !== 1) return undefined;
  if (Object.keys(expense.weights ?? {}).length > 0) return undefined;
  const ids = [...parts.flatMap((p) => p.shares), expense.shares[0]!];
  if (parts.some((p) => p.shares.length !== 1) || new Set(ids).size !== ids.length) {
    return undefined;
  }
  const owed = owedShares(expense);
  return owed.size > 0 ? owed : undefined;
}

/** What the form starts from for an expense with parts: what each person pays now. */
export function amountsOf(
  expense: Pick<Expense, 'amountAgorot' | 'shares' | 'parts' | 'weights'>,
): Record<string, string> {
  return Object.fromEntries(
    [...owedShares(expense)]
      .filter(([, owed]) => owed > 0)
      .map(([id, owed]) => [id, formatAmount(owed)]),
  );
}

/** Agorot as the amount field takes them: `120`, `33.5`, `20.01`. */
const formatAmount = (agorot: number) =>
  agorot % 100 === 0 ? String(agorot / 100) : (agorot / 100).toFixed(2).replace(/0$/, '');
