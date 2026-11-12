import {
  formatShekel,
  owedShares,
  parseShekel,
  type Expense,
  type ExpensePart,
} from '@yallist/domain';

import { he, joinNames } from '@/i18n/he';

/** A part of a run's total as the checkout form holds it: the amount as typed. */
export interface PartDraft {
  label: string;
  amount: string;
  shares: string[];
}

/** As many parts as the API takes. */
export const MAX_PARTS = 10;

/** A new part starts with everyone in it: the payer unticks who isn't. */
export const newPart = (activeIds: readonly string[]): PartDraft => ({
  label: '',
  amount: '',
  shares: [...activeIds],
});

export interface RunSplit {
  /** The parts to send, named (`חלק 2` when left unnamed); empty without any. */
  parts: ExpensePart[];
  /** What the parts leave for the rest; undefined without a valid total. */
  rest?: number;
  /** What each person pays, adding up to the total; empty until it's valid. */
  owed: Map<string, number>;
  /** Why it can't be saved yet, if it can't. */
  error?: string;
}

/**
 * The checkout's split of `total`: each part between its own people, what they leave between
 * `shares`. The API takes the same parts and checks the same rules.
 */
export function runSplit(
  total: number | undefined,
  shares: readonly string[],
  drafts: readonly PartDraft[],
): RunSplit {
  const parts = drafts.map((d, i) => ({
    label: d.label.trim() || he.shop.finish.partDefault(i + 1),
    amountAgorot: parseShekel(d.amount) ?? 0,
    shares: [...d.shares],
  }));
  const rest = total && total - parts.reduce((sum, p) => sum + p.amountAgorot, 0);
  const fail = (error: string): RunSplit => ({ parts, rest, owed: new Map(), error });
  if (!total) return fail(he.item.enterAmount);
  if (parts.some((p) => !p.amountAgorot)) return fail(he.invalidAmount);
  if (rest! <= 0) return fail(he.shop.finish.partsOver);
  if (shares.length === 0 || parts.some((p) => p.shares.length === 0)) {
    return fail(he.item.pickSomeone);
  }
  return { parts, rest, owed: owedShares({ amountAgorot: total, shares: [...shares], parts }) };
}

/**
 * Who shares an expense, after the payer's name: nothing when everyone shares it equally, else
 * their names, and per part when it has parts (`אלכוהול ₪120: דנה ורון · השאר: כולם`).
 */
export function sharedText(
  expense: Pick<Expense, 'shares' | 'parts'>,
  activeIds: readonly string[],
  nameOf: (id: string) => string,
): string | undefined {
  const names = (ids: string[]) =>
    activeIds.length > 0 && activeIds.every((id) => ids.includes(id))
      ? he.money.everyone
      : joinNames(ids.map(nameOf));
  const parts = expense.parts ?? [];
  if (parts.length === 0) {
    const all = names(expense.shares) === he.money.everyone;
    return all ? undefined : he.money.between(names(expense.shares));
  }
  return [
    ...parts.map((p) => he.money.part(p.label, formatShekel(p.amountAgorot), names(p.shares))),
    he.money.rest(names(expense.shares)),
  ].join(' · ');
}
