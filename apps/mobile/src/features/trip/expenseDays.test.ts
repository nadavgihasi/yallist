import { describe, expect, it } from 'vitest';

import { dayLabel, expenseDays } from './expenseDays';

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
});

describe('dayLabel', () => {
  it('names today and yesterday', () => {
    expect(dayLabel('2026-11-14', '2026-11-14')).toMatch(/^היום · /);
    expect(dayLabel('2026-11-13', '2026-11-14')).toMatch(/^אתמול · /);
    expect(dayLabel('2026-11-11', '2026-11-14')).not.toMatch(/היום|אתמול/);
  });
});
