import { owedShares } from '@yallist/domain';
import { describe, expect, it } from 'vitest';

import { he } from '@/i18n/he';

import { amountSplit, amountsOf, byAmounts } from './amountSplit';

const order = ['a', 'b', 'c', 'd'];
const names: Record<string, string> = { a: 'דנה', b: 'רון', c: 'יעל', d: 'עומר' };
const nameOf = (id: string) => names[id] ?? id;

describe('amountSplit', () => {
  it('gives each person their own amount, and saves as the API takes it', () => {
    // ₪300: Dana ₪120.50, Ron ₪100, Omer the rest; Yael nothing.
    const split = amountSplit(30000, { a: '120.5', b: '100', c: ' ', d: '79.50' }, order, nameOf);
    expect(split.error).toBeUndefined();
    expect(split.parts).toEqual([
      { label: 'דנה', amountAgorot: 12050, shares: ['a'] },
      { label: 'רון', amountAgorot: 10000, shares: ['b'] },
    ]);
    expect(split.shares).toEqual(['d']);
    expect(Object.fromEntries(split.owed)).toEqual({ a: 12050, b: 10000, d: 7950 });
    // The API's own split of what's sent comes to the same amounts.
    expect(owedShares({ amountAgorot: 30000, shares: split.shares, parts: split.parts })).toEqual(
      split.owed,
    );
  });

  it('takes one person paying all of it', () => {
    const split = amountSplit(5000, { c: '50' }, order, nameOf);
    expect(split.error).toBeUndefined();
    expect(split.parts).toEqual([]);
    expect(split.shares).toEqual(['c']);
  });

  it('says what is left to assign, or how much over it is', () => {
    expect(amountSplit(30000, { a: '100' }, order, nameOf)).toMatchObject({
      left: 20000,
      error: he.addExpense.amountsLeft('₪200'),
    });
    expect(amountSplit(30000, { a: '200', b: '150' }, order, nameOf)).toMatchObject({
      left: -5000,
      error: he.addExpense.amountsOver('₪50'),
    });
  });

  it('says what else is missing', () => {
    expect(amountSplit(undefined, { a: '10' }, order, nameOf).error).toBe(he.item.enterAmount);
    expect(amountSplit(1000, {}, order, nameOf).error).toBe(he.item.pickSomeone);
    expect(amountSplit(1000, { a: 'abc', b: '10' }, order, nameOf).error).toBe(he.invalidAmount);
    expect(amountSplit(1000, { a: '5' }, order, nameOf).owed.size).toBe(0);
  });
});

describe('byAmounts', () => {
  const total = { amountAgorot: 30000 };
  it('reads back an expense saved by amount', () => {
    const split = amountSplit(30000, { a: '120', b: '100', d: '80' }, order, nameOf);
    expect(byAmounts({ ...total, shares: split.shares, parts: split.parts })).toEqual(split.owed);
  });

  it("isn't fooled by other splits", () => {
    const alcohol = { label: 'אלכוהול', amountAgorot: 12000, shares: ['a', 'b'] };
    expect(byAmounts({ ...total, shares: order })).toBeUndefined();
    expect(byAmounts({ ...total, shares: ['c'], parts: [alcohol] })).toBeUndefined();
    expect(
      byAmounts({ ...total, shares: order, parts: [{ ...alcohol, shares: ['a'] }] }),
    ).toBeUndefined();
    // The rest for someone who also has a part: not one amount each.
    expect(
      byAmounts({ ...total, shares: ['a'], parts: [{ ...alcohol, shares: ['a'] }] }),
    ).toBeUndefined();
    expect(
      byAmounts({
        ...total,
        shares: ['b'],
        parts: [{ ...alcohol, shares: ['a'] }],
        weights: { b: 2 },
      }),
    ).toBeUndefined();
  });
});

describe('amountsOf', () => {
  it('opens a split with parts as what each person pays', () => {
    // ₪300 run, ₪120 of alcohol for Dana and Ron, the rest between all four.
    const alcohol = { label: 'אלכוהול', amountAgorot: 12000, shares: ['a', 'b'] };
    expect(amountsOf({ amountAgorot: 30001, shares: order, parts: [alcohol] })).toEqual({
      a: '105.01',
      b: '105',
      c: '45',
      d: '45',
    });
  });
});
