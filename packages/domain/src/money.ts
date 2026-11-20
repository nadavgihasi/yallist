import type { Expense, Payment } from './types';

/**
 * Split `amount` agorot equally among `participants`: integer division, then the
 * remainder one agora at a time in a stable order (sorted user id).
 */
export function splitEqually(amount: number, participants: readonly string[]): Map<string, number> {
  const ids = [...new Set(participants)].sort();
  const result = new Map<string, number>();
  if (ids.length === 0) return result;
  const base = Math.floor(amount / ids.length);
  const remainder = amount - base * ids.length;
  ids.forEach((id, i) => result.set(id, base + (i < remainder ? 1 : 0)));
  return result;
}

/** The most shares of an expense one person can take: an expense's weights run 1 to this. */
export const MAX_WEIGHT = 10;

/**
 * Split `amount` agorot by `weights` (1 for anyone not in it): each person's share rounded down,
 * then what that leaves one agora at a time in `splitEqually`'s order (sorted user id). With
 * every weight 1 this is `splitEqually`.
 */
export function splitByWeight(
  amount: number,
  participants: readonly string[],
  weights: Readonly<Record<string, number>> = {},
): Map<string, number> {
  const ids = [...new Set(participants)].sort();
  const weightOf = (id: string) => weights[id] ?? 1;
  const total = ids.reduce((sum, id) => sum + weightOf(id), 0);
  const result = new Map<string, number>();
  if (total === 0) return result;
  let left = amount;
  for (const id of ids) {
    const share = Math.floor((amount * weightOf(id)) / total);
    result.set(id, share);
    left -= share;
  }
  for (const id of ids) {
    if (left === 0) break;
    result.set(id, result.get(id)! + 1);
    left -= 1;
  }
  return result;
}

/**
 * What each participant owes for an expense. Each part is split equally between its own shares,
 * and what the parts leave between the expense's shares by their weights, each with
 * `splitEqually`'s rule for the agorot left over, so the amounts add up to the expense exactly. Empty when they can't (parts over the total, or an
 * amount that nobody shares): such an expense isn't split at all.
 */
export function owedShares(
  expense: Pick<Expense, 'amountAgorot' | 'shares' | 'parts' | 'weights'>,
): Map<string, number> {
  const parts = expense.parts ?? [];
  const rest = expense.amountAgorot - parts.reduce((sum, p) => sum + p.amountAgorot, 0);
  const groups = [
    ...parts.map((p) => ({ ...p, weights: undefined })),
    { amountAgorot: rest, shares: expense.shares, weights: expense.weights },
  ];
  const result = new Map<string, number>();
  for (const { amountAgorot, shares, weights } of groups) {
    if (amountAgorot < 0 || (amountAgorot > 0 && shares.length === 0)) return new Map();
    for (const [id, owed] of splitByWeight(amountAgorot, shares, weights)) {
      result.set(id, (result.get(id) ?? 0) + owed);
    }
  }
  return result;
}

/** paid − owed + payments sent − payments received. Positive: the group owes them. */
export function balances(
  memberIds: readonly string[],
  expenses: readonly Expense[],
  payments: readonly Payment[],
): Map<string, number> {
  const result = new Map<string, number>(memberIds.map((id) => [id, 0]));
  const add = (id: string, delta: number) => result.set(id, (result.get(id) ?? 0) + delta);
  for (const e of expenses) {
    // An expense that can't be split (nobody shares it) is skipped: balances still sum to zero.
    const owed = owedShares(e);
    if (owed.size === 0) continue;
    add(e.paidBy, e.amountAgorot);
    for (const [id, amount] of owed) add(id, -amount);
  }
  for (const p of payments) {
    add(p.fromUser, p.amountAgorot);
    add(p.toUser, -p.amountAgorot);
  }
  return result;
}

export interface Transfer {
  from: string;
  to: string;
  amountAgorot: number;
}

/** Repeatedly match the largest debtor with the largest creditor (ties broken by user id). */
export function suggestTransfers(balance: ReadonlyMap<string, number>): Transfer[] {
  const byAmount = (a: [string, number], b: [string, number]) =>
    b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  const creditors = [...balance].filter(([, v]) => v > 0);
  const debtors = [...balance]
    .filter(([, v]) => v < 0)
    .map(([id, v]): [string, number] => [id, -v]);
  const transfers: Transfer[] = [];
  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort(byAmount);
    debtors.sort(byAmount);
    const creditor = creditors[0]!;
    const debtor = debtors[0]!;
    const amount = Math.min(creditor[1], debtor[1]);
    transfers.push({ from: debtor[0], to: creditor[0], amountAgorot: amount });
    creditor[1] -= amount;
    debtor[1] -= amount;
    if (creditor[1] === 0) creditors.shift();
    if (debtor[1] === 0) debtors.shift();
  }
  return transfers;
}

/**
 * `₪90`, `₪12.35`, `₪2,040`, `₪41,152.26`: the sign first, thousands grouped with a comma, and
 * agorot only when there are any. The one money format in the app; a fraction of an agora rounds
 * to the nearest agora.
 */
export function formatShekel(agorot: number): string {
  const rounded = Math.round(agorot);
  const abs = Math.abs(rounded);
  const shekels = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = abs % 100;
  return `${rounded < 0 ? '-' : ''}₪${shekels}${cents ? `.${String(cents).padStart(2, '0')}` : ''}`;
}

/** An amount as an input's text, `412.90`: no sign, no grouping, always two decimals. */
export function shekelInput(agorot: number): string {
  return (Math.round(agorot) / 100).toFixed(2);
}

/**
 * Parse user input like "450", "12.5" or a sum typed at the till, "120+45.5", into agorot;
 * undefined if not a positive amount. A trailing "+" (the next number not typed yet) is ignored.
 */
export function parseShekel(input: string): number | undefined {
  const terms = input
    .trim()
    .replace(/\+\s*$/, '')
    .split('+');
  let total = 0;
  for (const term of terms) {
    const trimmed = term.trim().replace(/^₪/, '').replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return undefined;
    total += Math.round(Number(trimmed) * 100);
  }
  return total > 0 ? total : undefined;
}
