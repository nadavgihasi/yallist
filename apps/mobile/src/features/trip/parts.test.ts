import type { Claim, Item } from '@yallist/domain';
import { describe, expect, it } from 'vitest';

import { bringPart, moneyPart, myItems, myPackedCount, partOf, sharedItems } from './parts';

const item = (id: string, kind: Item['kind'] = 'single'): Item => ({
  id,
  list: 'bring',
  position: 0,
  name: id,
  kind,
  quantityNeeded: kind === 'qty' ? 4 : 1,
});
const claim = (itemId: string, userId: string, packed = false): Claim => ({
  itemId,
  userId,
  quantity: 1,
  packed,
});

const tent = item('tent');
const coals = item('coals', 'qty');
const bag = item('sleeping bag', 'each');
const towel = item('towel', 'each');
const items = [tent, coals, bag, towel];

describe('parts', () => {
  it('opens equipment on the shared list and money on the expenses', () => {
    expect(bringPart()).toBe('shared');
    expect(bringPart('mine')).toBe('mine');
    expect(bringPart('settle')).toBe('shared');
    expect(moneyPart()).toBe('expenses');
    expect(moneyPart('settle')).toBe('settle');
    expect(moneyPart('mine')).toBe('expenses');
  });

  it('keeps "everyone brings their own" items off the shared list', () => {
    expect(sharedItems(items)).toEqual([tent, coals]);
  });

  it('puts every "each" item and what I took on my list', () => {
    const claims = [claim('tent', 'me'), claim('coals', 'dana')];
    expect(myItems(items, claims, 'me')).toEqual([tent, bag, towel]);
  });

  it('counts only my own packed claims', () => {
    const claims = [
      claim('tent', 'me', true),
      claim('sleeping bag', 'me'),
      claim('towel', 'dana', true),
    ];
    expect(myPackedCount(items, claims, 'me')).toBe(1);
  });

  it('shows an added item where it lives', () => {
    expect(partOf(bag)).toBe('mine');
    expect(partOf(tent)).toBe('shared');
  });
});
