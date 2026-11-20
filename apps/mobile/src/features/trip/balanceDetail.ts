import { owedShares, type Expense, type Payment } from '@yallist/domain';

export interface ExpenseLine<E> {
  expense: E;
  amountAgorot: number;
}

/** What one person's balance is made of, by the same rules as `balances`. */
export interface BalanceBreakdown<E> {
  /** Expenses they paid, at their whole amount. */
  paid: ExpenseLine<E>[];
  /** Their share of each expense they share. */
  owed: ExpenseLine<E>[];
  /** Payments they made, and received. */
  sent: Payment[];
  received: Payment[];
  paidTotal: number;
  owedTotal: number;
  sentTotal: number;
  receivedTotal: number;
  /** paid − owed + sent − received: positive, the group owes them. */
  balance: number;
}

const total = (xs: readonly { amountAgorot: number }[]) =>
  xs.reduce((sum, x) => sum + x.amountAgorot, 0);

/**
 * Why `userId`'s balance is what it is: each expense they paid, their share of each one they
 * share, and the payments either way. An expense nobody can be charged for (see `balances`)
 * counts for no one, here too.
 */
export function balanceBreakdown<E extends Expense>(
  userId: string,
  expenses: readonly E[],
  payments: readonly Payment[],
): BalanceBreakdown<E> {
  const paid: ExpenseLine<E>[] = [];
  const owed: ExpenseLine<E>[] = [];
  for (const expense of expenses) {
    const shares = owedShares(expense);
    if (shares.size === 0) continue;
    if (expense.paidBy === userId) paid.push({ expense, amountAgorot: expense.amountAgorot });
    const mine = shares.get(userId) ?? 0;
    if (mine > 0) owed.push({ expense, amountAgorot: mine });
  }
  const sent = payments.filter((p) => p.fromUser === userId);
  const received = payments.filter((p) => p.toUser === userId);
  const [paidTotal, owedTotal, sentTotal, receivedTotal] = [paid, owed, sent, received].map(total);
  return {
    paid,
    owed,
    sent,
    received,
    paidTotal: paidTotal!,
    owedTotal: owedTotal!,
    sentTotal: sentTotal!,
    receivedTotal: receivedTotal!,
    balance: paidTotal! - owedTotal! + sentTotal! - receivedTotal!,
  };
}
