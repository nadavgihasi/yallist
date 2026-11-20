import { balances, type Expense, type Payment } from '@yallist/domain';
import { describe, expect, it } from 'vitest';

import { balanceBreakdown } from './balanceDetail';

const expense = (id: string, paidBy: string, amountAgorot: number, shares: string[]): Expense => ({
  id,
  description: id,
  amountAgorot,
  paidBy,
  shares,
});
const payment = (fromUser: string, toUser: string, amountAgorot: number): Payment => ({
  id: `${fromUser}-${toUser}`,
  fromUser,
  toUser,
  amountAgorot,
  createdBy: fromUser,
  createdAt: '2026-11-18T10:00:00.000Z',
});

describe('balanceBreakdown', () => {
  const expenses = [
    expense('zimmer', 'dana', 120000, ['me', 'dana', 'ron', 'noa']),
    expense('super', 'me', 64000, ['me', 'dana', 'ron', 'noa']),
    expense('fuel', 'noa', 28000, ['me', 'noa']),
    // Shared by nobody: counts for no one.
    expense('broken', 'ron', 5000, []),
  ];
  const payments = [payment('noa', 'me', 8000), payment('ron', 'dana', 10000)];

  it('adds up to the balance the money tab shows, for everyone', () => {
    const all = balances(['me', 'dana', 'ron', 'noa'], expenses, payments);
    for (const id of ['me', 'dana', 'ron', 'noa']) {
      expect(balanceBreakdown(id, expenses, payments).balance).toBe(all.get(id));
    }
  });

  it('lists what I paid, my share of each expense, and the payments', () => {
    const mine = balanceBreakdown('me', expenses, payments);
    expect(mine.paid.map((l) => [l.expense.id, l.amountAgorot])).toEqual([['super', 64000]]);
    expect(mine.owed.map((l) => [l.expense.id, l.amountAgorot])).toEqual([
      ['zimmer', 30000],
      ['super', 16000],
      ['fuel', 14000],
    ]);
    expect(mine.received).toEqual([payments[0]]);
    expect(mine).toMatchObject({ paidTotal: 64000, owedTotal: 60000, receivedTotal: 8000 });
    expect(mine.balance).toBe(64000 - 60000 - 8000);
  });

  it('skips an expense nobody can be charged for', () => {
    expect(balanceBreakdown('ron', expenses, payments).paid).toEqual([]);
  });
});
