import type { Item } from '@yallist/domain';
import { describe, expect, it } from 'vitest';

import { he } from '@/i18n/he';

import {
  amountFields,
  buyAmountError,
  buyDisplayQty,
  countedByKind,
  initialBuyAmount,
} from './buyAmount';

const item = (over: Partial<Item>): Item => ({
  id: 'i',
  list: 'buy',
  position: 0,
  name: 'בשר',
  kind: 'single',
  quantityNeeded: 1,
  ...over,
});

describe('initialBuyAmount', () => {
  it('starts a new item empty', () => {
    expect(initialBuyAmount(undefined)).toEqual({ amount: '' });
  });

  it('reads back the amount and unit of a buy item', () => {
    expect(initialBuyAmount(item({ displayQty: '4 ק״ג' }))).toEqual({ amount: '4', unit: 'ק״ג' });
    expect(initialBuyAmount(item({ displayQty: '40' }))).toEqual({ amount: '40' });
    // As the bulk add on main stored it before it spelled units as the chips do.
    expect(initialBuyAmount(item({ displayQty: '2 ק"ג' }))).toEqual({ amount: '2', unit: 'ק״ג' });
  });

  it('turns an older quantity item’s count into an amount', () => {
    expect(initialBuyAmount(item({ kind: 'qty', quantityNeeded: 6 }))).toEqual({
      amount: '6',
      unit: 'יח׳',
    });
    expect(initialBuyAmount(item({ kind: 'qty', quantityNeeded: 2, unit: 'שקים' }))).toEqual({
      amount: '2',
      unit: 'שקים',
    });
  });

  it('ignores a bring item', () => {
    expect(initialBuyAmount(item({ list: 'bring', displayQty: '2' }))).toEqual({ amount: '' });
  });
});

describe('buyDisplayQty', () => {
  it('saves what was typed', () => {
    expect(buyDisplayQty(undefined, { amount: '1,5', unit: 'ק״ג' })).toBe('1.5 ק״ג');
    expect(buyDisplayQty(undefined, { amount: '' })).toBeNull();
    expect(buyDisplayQty(item({ displayQty: '2 ק״ג' }), { amount: '' })).toBeNull();
    expect(buyDisplayQty(item({ displayQty: '2 ק״ג' }), { amount: '3', unit: 'ק״ג' })).toBe(
      '3 ק״ג',
    );
  });

  it('keeps an amount the form does not write while it is not changed', () => {
    for (const text of ['2-3 ק״ג', 'הרבה', '2.5 גרם', '2 ק"ג', '6 שישיות']) {
      const stored = item({ displayQty: text });
      expect(buyDisplayQty(stored, initialBuyAmount(stored)), text).toBe(text);
    }
    // Changed, it is checked as typed.
    const odd = item({ displayQty: '2-3 ק״ג' });
    expect(buyDisplayQty(odd, { amount: '2-4 ק״ג' })).toBeUndefined();
    expect(buyDisplayQty(odd, { amount: '3', unit: 'ק״ג' })).toBe('3 ק״ג');
  });

  it('writes an older quantity item’s count as its amount', () => {
    const old = item({ kind: 'qty', quantityNeeded: 8 });
    expect(buyDisplayQty(old, initialBuyAmount(old))).toBe('8 יח׳');
  });
});

describe('countedByKind', () => {
  it('keeps the kinds for a quantity or per-person item someone took', () => {
    expect(countedByKind(item({ kind: 'qty', quantityNeeded: 4 }), true)).toBe(true);
    expect(countedByKind(item({ kind: 'each' }), true)).toBe(true);
  });

  it('counts by amount otherwise', () => {
    expect(countedByKind(undefined, false)).toBe(false);
    expect(countedByKind(item({ kind: 'qty', quantityNeeded: 4 }), false)).toBe(false);
    expect(countedByKind(item({ kind: 'single' }), true)).toBe(false);
  });
});

describe('amountFields', () => {
  it('saves a buy item by amount as one for the group', () => {
    expect(amountFields(undefined, 'buy', true, '2 ק״ג')).toEqual({
      kind: 'single',
      quantityNeeded: 1,
      displayQty: '2 ק״ג',
    });
    expect(amountFields(item({ kind: 'qty', quantityNeeded: 4 }), 'buy', true, null)).toEqual({
      kind: 'single',
      quantityNeeded: 1,
      displayQty: null,
    });
  });

  it('leaves the amount text of an item counted by kind as it is', () => {
    // A bring item with an amount from a bulk add or a copy keeps it.
    expect(
      amountFields(item({ list: 'bring', displayQty: '3 ק״ג' }), 'bring', false, null),
    ).toEqual({});
    expect(amountFields(undefined, 'bring', false, null)).toEqual({});
    // A quantity buy item someone took: its kind and count are the form's, as on the bring list.
    expect(amountFields(item({ kind: 'qty', quantityNeeded: 4 }), 'buy', false, '4 יח׳')).toEqual(
      {},
    );
  });

  it('drops the amount of a buy item moved to the bring list', () => {
    expect(amountFields(item({ displayQty: '2 ק״ג' }), 'bring', false, '2 ק״ג')).toEqual({
      displayQty: null,
    });
  });
});

describe('buyAmountError', () => {
  it('explains why an amount is refused', () => {
    expect(buyAmountError({ amount: '' })).toBeUndefined();
    expect(buyAmountError({ amount: '1.5', unit: 'ק״ג' })).toBeUndefined();
    expect(buyAmountError({ amount: '1.5', unit: 'חבילה' })).toBe(he.addItem.wholeAmount);
    expect(buyAmountError({ amount: '1,5' })).toBe(he.addItem.wholeAmount);
    expect(buyAmountError({ amount: 'abc' })).toBe(he.addItem.badAmount);
    expect(buyAmountError({ amount: '0' })).toBe(he.addItem.badAmount);
    expect(buyAmountError({ amount: '1.234', unit: 'ק״ג' })).toBe(he.addItem.badAmount);
    expect(buyAmountError({ amount: '10000', unit: 'ק״ג' })).toBe(he.addItem.maxAmount);
    expect(buyAmountError({ amount: ' ', unit: 'ק״ג' })).toBe(he.addItem.noAmount);
  });
});
