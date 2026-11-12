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

/** paid − owed + payments sent − payments received. Positive: the group owes them. */
export function balances(
  memberIds: readonly string[],
  expenses: readonly Expense[],
  payments: readonly Payment[],
): Map<string, number> {
  const result = new Map<string, number>(memberIds.map((id) => [id, 0]));
  const add = (id: string, delta: number) => result.set(id, (result.get(id) ?? 0) + delta);
  for (const e of expenses) {
    // An expense nobody shares can't be split; skipping it keeps balances summing to zero.
    if (e.shares.length === 0) continue;
    add(e.paidBy, e.amountAgorot);
    for (const [id, owed] of splitEqually(e.amountAgorot, e.shares)) add(id, -owed);
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
 * `₪90.00`, `₪12.35`, `₪412.90`: sign before the number, always two decimals. The one money
 * format in the app; a fraction of an agora rounds to the nearest agora.
 */
export function formatShekel(agorot: number): string {
  return `₪${(Math.round(agorot) / 100).toFixed(2)}`;
}

/** An amount as an input's text, `412.90`: what `formatShekel` shows, without the sign. */
export function shekelInput(agorot: number): string {
  return formatShekel(agorot).slice(1);
}

/** Parse user input like "450" or "12.5" into agorot; undefined if not a positive amount. */
export function parseShekel(input: string): number | undefined {
  const trimmed = input.trim().replace(/^₪/, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return undefined;
  const agorot = Math.round(Number(trimmed) * 100);
  return agorot > 0 ? agorot : undefined;
}
