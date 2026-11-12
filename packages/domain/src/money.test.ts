import { describe, expect, it } from 'vitest';

import {
  balances,
  formatShekel,
  owedShares,
  parseShekel,
  shekelInput,
  splitEqually,
  suggestTransfers,
} from './money';
import type { Expense, ExpensePart, Payment } from './types';

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

  it('handles a payer who is not among the shares', () => {
    const b = balances(['a', 'b', 'c'], [expense('a', 600, ['b', 'c'])], []);
    expect(Object.fromEntries(b)).toEqual({ a: 600, b: -300, c: -300 });
  });

  it('ignores an expense with no shares', () => {
    const b = balances(['a', 'b'], [expense('a', 600, [])], []);
    expect(Object.fromEntries(b)).toEqual({ a: 0, b: 0 });
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

describe('owedShares', () => {
  const part = (amountAgorot: number, shares: string[]): ExpensePart => ({
    label: 'אלכוהול',
    amountAgorot,
    shares,
  });
  const run = (amountAgorot: number, shares: string[], parts: ExpensePart[]): Expense => ({
    ...expense('a', amountAgorot, shares),
    parts,
  });
  const total = (owed: Map<string, number>) => [...owed.values()].reduce((s, v) => s + v, 0);

  it('splits equally between the shares without parts', () => {
    expect(owedShares(expense('a', 900, ['a', 'b', 'c']))).toEqual(
      splitEqually(900, ['a', 'b', 'c']),
    );
  });

  it('leaves out who is not part of it', () => {
    expect(Object.fromEntries(owedShares(expense('a', 900, ['a', 'c'])))).toEqual({
      a: 450,
      c: 450,
    });
  });

  it('splits a part between its own people and the rest between everyone', () => {
    // ₪300 run: ₪120 of alcohol for a, b, c, d; the other ₪180 for all five.
    const e = run(30000, ['a', 'b', 'c', 'd', 'e'], [part(12000, ['a', 'b', 'c', 'd'])]);
    expect(Object.fromEntries(owedShares(e))).toEqual({
      a: 3000 + 3600,
      b: 3000 + 3600,
      c: 3000 + 3600,
      d: 3000 + 3600,
      e: 3600,
    });
  });

  it('takes several parts, and people in some of them only', () => {
    const e = run(
      10000,
      ['a', 'b', 'c'],
      [part(3000, ['a', 'b']), { label: 'בשר', amountAgorot: 4000, shares: ['b', 'c', 'x'] }],
    );
    const owed = owedShares(e);
    expect(total(owed)).toBe(10000);
    expect(owed.get('x')).toBe(1333);
    expect(owed.get('b')).toBe(1500 + 1334 + 1000);
  });

  it('always adds up to the total, the remainders by user id', () => {
    for (const amount of [1001, 9999, 12345, 100]) {
      const e = run(amount + 77, ['c', 'a', 'b'], [part(amount, ['b', 'd', 'a'])]);
      expect(total(owedShares(e)), String(amount)).toBe(amount + 77);
    }
    // 100 between 3: the first id by sort order gets the extra agora, in each group alike.
    const e = run(200, ['c', 'b', 'a'], [part(100, ['c', 'b', 'a'])]);
    expect(Object.fromEntries(owedShares(e))).toEqual({ a: 68, b: 66, c: 66 });
  });

  it('can leave nothing for the rest', () => {
    const e = run(500, [], [part(500, ['a', 'b'])]);
    expect(Object.fromEntries(owedShares(e))).toEqual({ a: 250, b: 250 });
  });

  it('refuses parts over the total, or an amount nobody shares', () => {
    expect(owedShares(run(500, ['a'], [part(600, ['a'])])).size).toBe(0);
    expect(owedShares(run(500, ['a'], [part(100, [])])).size).toBe(0);
    expect(owedShares(run(500, [], [part(100, ['a'])])).size).toBe(0);
  });

  it('settles a run with a part, a former member among its people', () => {
    // a paid ₪300; ₪120 alcohol for a, b and x (removed since); the rest for a, b, c.
    const e = run(30000, ['a', 'b', 'c'], [part(12000, ['a', 'b', 'x'])]);
    const b = balances(['a', 'b', 'c'], [e], []);
    expect(Object.fromEntries(b)).toEqual({
      a: 30000 - 4000 - 6000,
      b: -4000 - 6000,
      c: -6000,
      x: -4000,
    });
    expect([...b.values()].reduce((s, v) => s + v, 0)).toBe(0);
    const transfers = suggestTransfers(b);
    expect(transfers.reduce((s, t) => s + t.amountAgorot, 0)).toBe(20000);
    expect(transfers.every((t) => t.to === 'a')).toBe(true);
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
  it('formats with two decimals, always', () => {
    expect(formatShekel(9000)).toBe('₪90.00');
    expect(formatShekel(1235)).toBe('₪12.35');
    expect(formatShekel(41290)).toBe('₪412.90');
    expect(formatShekel(7980)).toBe('₪79.80');
    expect(formatShekel(5)).toBe('₪0.05');
    expect(formatShekel(0)).toBe('₪0.00');
  });

  it('rounds a fraction of an agora to the nearest agora', () => {
    expect(formatShekel(13763.33)).toBe('₪137.63');
    expect(formatShekel(13763.5)).toBe('₪137.64');
  });

  it('fills an amount input with two decimals, which parses back', () => {
    expect(shekelInput(41290)).toBe('412.90');
    expect(shekelInput(9000)).toBe('90.00');
    expect(parseShekel(shekelInput(41290))).toBe(41290);
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
