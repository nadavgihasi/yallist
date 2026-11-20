import { describe, expect, it } from 'vitest';

import { dayLabel, expenseDays, expenseEffect } from './expenseDays';

const at = (id: string, createdAt: string, amountAgorot: number, spentOn?: string) => ({
  id,
  createdAt,
  amountAgorot,
  ...(spentOn && { spentOn }),
});

describe('expenseDays', () => {
  it('groups by the day spent, newest day and newest expense first', () => {
    const expenses = [
      at('zimmer', '2026-11-11T09:00:00', 120000),
      at('fuel', '2026-11-13T09:00:00', 28000),
      at('super', '2026-11-13T18:00:00', 64000),
      // Added today, spent yesterday: under yesterday.
      at('coffee', '2026-11-14T08:00:00', 3000, '2026-11-13'),
      at('ice', '2026-11-14T12:00:00', 8000),
    ];
    const days = expenseDays(expenses);
    expect(days.map((d) => [d.day, d.expenses.map((e) => e.id), d.totalAgorot])).toEqual([
      ['2026-11-14', ['ice'], 8000],
      ['2026-11-13', ['coffee', 'super', 'fuel'], 95000],
      ['2026-11-11', ['zimmer'], 120000],
    ]);
  });

  it('puts payments under the day they were recorded, without counting them in the total', () => {
    const days = expenseDays(
      [at('ice', '2026-11-14T12:00:00', 8000)],
      [
        { id: 'p1', createdAt: '2026-11-14T13:00:00' },
        { id: 'p2', createdAt: '2026-11-12T09:00:00' },
      ],
    );
    expect(
      days.map((d) => [d.day, d.expenses.length, d.payments.map((p) => p.id), d.totalAgorot]),
    ).toEqual([
      ['2026-11-14', 1, ['p1'], 8000],
      ['2026-11-12', 0, ['p2'], 0],
    ]);
  });
});

describe('expenseEffect', () => {
  const dinner = { amountAgorot: 30000, paidBy: 'me', shares: ['me', 'dana', 'ron'] };
  it('is what comes back to me when I paid', () => {
    expect(expenseEffect(dinner, 'me')).toEqual({ kind: 'lent', amountAgorot: 20000 });
  });
  it('is my share when someone else paid, and nothing when I am not in it', () => {
    expect(expenseEffect({ ...dinner, paidBy: 'dana' }, 'me')).toEqual({
      kind: 'share',
      amountAgorot: 10000,
    });
    expect(expenseEffect({ ...dinner, paidBy: 'dana', shares: ['dana', 'ron'] }, 'me')).toEqual({
      kind: 'none',
    });
  });
  it('is my own when I paid only for myself', () => {
    expect(expenseEffect({ ...dinner, shares: ['me'] }, 'me')).toEqual({ kind: 'own' });
  });
});

describe('dayLabel', () => {
  it('names today and yesterday', () => {
    expect(dayLabel('2026-11-14', '2026-11-14')).toMatch(/^היום · /);
    expect(dayLabel('2026-11-13', '2026-11-14')).toMatch(/^אתמול · /);
    expect(dayLabel('2026-11-11', '2026-11-14')).not.toMatch(/היום|אתמול/);
  });
});
