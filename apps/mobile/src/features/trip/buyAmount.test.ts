import { CATALOG, type Item } from '@yallist/domain';
import { describe, expect, it } from 'vitest';

import { he } from '@/i18n/he';

import { buyAmountError, buyItemFields, catalogBuyAmount, initialBuyAmount } from './buyAmount';

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

describe('catalogBuyAmount', () => {
  it('fills the amount from a suggestion’s default count', () => {
    const entry = { ...CATALOG.find((e) => e.list === 'buy')!, kind: 'qty' as const };
    expect(catalogBuyAmount({ ...entry, quantityNeeded: 6 })).toEqual({ amount: '6', unit: 'יח׳' });
    expect(catalogBuyAmount({ ...entry, kind: 'single', quantityNeeded: 1 })).toBeUndefined();
  });
});

describe('buyItemFields', () => {
  it('saves a buy item as one for the group, with its amount', () => {
    expect(buyItemFields(undefined, false, '2 ק״ג')).toEqual({
      kind: 'single',
      quantityNeeded: 1,
      displayQty: '2 ק״ג',
    });
    expect(buyItemFields(item({ kind: 'qty', quantityNeeded: 4 }), false, null)).toEqual({
      kind: 'single',
      quantityNeeded: 1,
      displayQty: null,
    });
  });

  it('keeps how a claimed item is counted, which the API won’t change', () => {
    expect(buyItemFields(item({ kind: 'qty', quantityNeeded: 4 }), true, '4 יח׳')).toEqual({
      kind: 'qty',
      quantityNeeded: 4,
      displayQty: '4 יח׳',
    });
  });
});

describe('buyAmountError', () => {
  it('explains why an amount is refused', () => {
    expect(buyAmountError({ amount: '' })).toBeUndefined();
    expect(buyAmountError({ amount: '1.5', unit: 'ק״ג' })).toBeUndefined();
    expect(buyAmountError({ amount: '1.5', unit: 'חבילה' })).toBe(he.addItem.wholeAmount);
    expect(buyAmountError({ amount: 'abc' })).toBe(he.addItem.badAmount);
  });
});
