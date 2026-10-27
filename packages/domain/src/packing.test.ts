import { describe, expect, it } from 'vitest';

import { listProgress, packingStatus, withQuantity } from './packing';
import type { Claim, Item } from './types';

const item = (over: Partial<Item> & Pick<Item, 'id'>): Item => ({
  list: 'bring',
  position: 0,
  name: over.id,
  kind: 'single',
  quantityNeeded: 1,
  ...over,
});
const claim = (itemId: string, userId: string, quantity = 1, packed = false): Claim => ({
  itemId,
  userId,
  quantity,
  packed,
});
const active = ['me', 'ron', 'dana'];

describe('packingStatus', () => {
  it('missing until covered, even when the claims so far are packed', () => {
    const chairs = item({ id: 'chairs', kind: 'qty', quantityNeeded: 4 });
    expect(packingStatus(chairs, [], active)).toEqual({
      status: 'missing',
      packedCount: 0,
      claimCount: 0,
    });
    expect(packingStatus(chairs, [claim('chairs', 'me', 2, true)], active)).toEqual({
      status: 'missing',
      packedCount: 1,
      claimCount: 1,
    });
  });

  it('covered while a claim is unpacked, packed once all are', () => {
    const chairs = item({ id: 'chairs', kind: 'qty', quantityNeeded: 4 });
    const some = [claim('chairs', 'me', 2, true), claim('chairs', 'ron', 2)];
    expect(packingStatus(chairs, some, active)).toEqual({
      status: 'covered',
      packedCount: 1,
      claimCount: 2,
    });
    const all = [claim('chairs', 'me', 2, true), claim('chairs', 'ron', 2, true)];
    expect(packingStatus(chairs, all, active).status).toBe('packed');
    expect(packingStatus(item({ id: 'grill' }), [claim('grill', 'ron', 1, true)], active)).toEqual({
      status: 'packed',
      packedCount: 1,
      claimCount: 1,
    });
  });

  it('counts only active members on an "each" item, as they join and leave', () => {
    const bag = item({ id: 'bag', kind: 'each' });
    const claims = [claim('bag', 'me', 1, true), claim('bag', 'ron', 1, true)];
    expect(packingStatus(bag, claims, active)).toEqual({
      status: 'missing',
      packedCount: 2,
      claimCount: 2,
    });
    // Dana left: everyone left has one, and packed it.
    expect(packingStatus(bag, [...claims, claim('bag', 'dana')], ['me', 'ron'])).toEqual({
      status: 'packed',
      packedCount: 2,
      claimCount: 2,
    });
    // Noa joined: missing again until she has one.
    expect(packingStatus(bag, claims, ['me', 'ron', 'noa']).status).toBe('missing');
  });
});

describe('listProgress', () => {
  it('counts covered and packed items', () => {
    const items = [
      item({ id: 'a' }),
      item({ id: 'b' }),
      item({ id: 'c' }),
      item({ id: 'd', kind: 'qty', quantityNeeded: 2 }),
    ];
    const claims = [claim('a', 'me', 1, true), claim('b', 'ron'), claim('d', 'ron', 1, true)];
    expect(listProgress(items, claims, active)).toEqual({ covered: 2, total: 4, packed: 1 });
    expect(listProgress([], claims, active)).toEqual({ covered: 0, total: 0, packed: 0 });
  });
});

describe('withQuantity', () => {
  it('unpacks a claim when its quantity goes up, and keeps it packed when it goes down', () => {
    const packed = claim('chairs', 'me', 2, true);
    expect(withQuantity(packed, 3)).toEqual(claim('chairs', 'me', 3, false));
    expect(withQuantity(packed, 1)).toEqual(claim('chairs', 'me', 1, true));
    expect(withQuantity(packed, 2)).toEqual(packed);
  });
});
