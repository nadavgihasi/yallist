import { describe, expect, it } from 'vitest';

import { balances, formatShekel, parseShekel, splitEqually, suggestTransfers } from './money';
import type { Expense, Payment } from './types';

const expense = (paidBy: string, amountAgorot: number, shares: string[]): Expense => ({
  id: `${paidBy}-${amountAgorot}`,
  description: '',
  paidBy,
  amountAgorot,
  shares,
});

describe('splitEqually', () => {
  it('splits evenly when divisible', () => {
    expect([...splitEqually(900, ['a', 'b', 'c'])]).toEqual([
      ['a', 300],
      ['b', 300],
      ['c', 300],
    ]);
  });

  it('gives the remainder one agora at a time in user-id order', () => {
    expect(Object.fromEntries(splitEqually(1000, ['c', 'a', 'b']))).toEqual({
      a: 334,
      b: 333,
      c: 333,
    });
    expect(Object.fromEntries(splitEqually(1001, ['c', 'a', 'b']))).toEqual({
      a: 334,
      b: 334,
      c: 333,
    });
  });

  it('always sums to the amount', () => {
    for (const amount of [1, 7, 99, 12345]) {
      const sum = [...splitEqually(amount, ['a', 'b', 'c', 'd', 'e', 'f', 'g']).values()].reduce(
        (s, v) => s + v,
        0,
      );
      expect(sum).toBe(amount);
    }
  });

  it('returns nothing for no participants', () => {
    expect(splitEqually(100, []).size).toBe(0);
  });
});

describe('balances', () => {
  it('credits the payer and debits participants, honoring exclusions', () => {
    const b = balances(
      ['a', 'b', 'c'],
      [expense('a', 900, ['a', 'b', 'c']), expense('b', 400, ['a', 'b'])],
      [],
    );
    expect(Object.fromEntries(b)).toEqual({ a: 900 - 300 - 200, b: 400 - 300 - 200, c: -300 });
  });

  it('includes recorded payments', () => {
    const payments: Payment[] = [
      { id: 'p', fromUser: 'c', toUser: 'a', amountAgorot: 300, status: 'marked' },
    ];
    const b = balances(['a', 'b', 'c'], [expense('a', 900, ['a', 'b', 'c'])], payments);
    expect(Object.fromEntries(b)).toEqual({ a: 300, b: -300, c: 0 });
  });

  it('always sums to zero', () => {
    const b = balances(
      ['a', 'b', 'c'],
      [expense('a', 1000, ['a', 'b', 'c']), expense('c', 777, ['b', 'c'])],
      [],
    );
    expect([...b.values()].reduce((s, v) => s + v, 0)).toBe(0);
  });
});

describe('suggestTransfers', () => {
  it('matches largest debtor with largest creditor', () => {
    const t = suggestTransfers(
      new Map([
        ['a', 600],
        ['b', -400],
        ['c', -200],
      ]),
    );
    expect(t).toEqual([
      { from: 'b', to: 'a', amountAgorot: 400 },
      { from: 'c', to: 'a', amountAgorot: 200 },
    ]);
  });

  it('breaks ties by user id', () => {
    const t = suggestTransfers(
      new Map([
        ['b', 100],
        ['a', 100],
        ['d', -100],
        ['c', -100],
      ]),
    );
    expect(t).toEqual([
      { from: 'c', to: 'a', amountAgorot: 100 },
      { from: 'd', to: 'b', amountAgorot: 100 },
    ]);
  });

  it('settles every balance', () => {
    const b = balances(
      ['a', 'b', 'c', 'd'],
      [
        expense('a', 12345, ['a', 'b', 'c', 'd']),
        expense('b', 5000, ['b', 'c']),
        expense('d', 999, ['a', 'd']),
      ],
      [],
    );
    const left = new Map(b);
    for (const t of suggestTransfers(b)) {
      left.set(t.from, left.get(t.from)! + t.amountAgorot);
      left.set(t.to, left.get(t.to)! - t.amountAgorot);
    }
    expect([...left.values()].every((v) => v === 0)).toBe(true);
  });

  it('returns nothing when settled', () => {
    expect(suggestTransfers(new Map([['a', 0]]))).toEqual([]);
  });
});

describe('formatShekel / parseShekel', () => {
  it('formats', () => {
    expect(formatShekel(9000)).toBe('₪90');
    expect(formatShekel(1235)).toBe('₪12.35');
    expect(formatShekel(1250)).toBe('₪12.5');
    expect(formatShekel(3333, 1)).toBe('₪33.3');
  });

  it('parses', () => {
    expect(parseShekel('450')).toBe(45000);
    expect(parseShekel('₪12.5')).toBe(1250);
    expect(parseShekel('12,35')).toBe(1235);
    expect(parseShekel('0')).toBeUndefined();
    expect(parseShekel('abc')).toBeUndefined();
    expect(parseShekel('1.234')).toBeUndefined();
  });
});
