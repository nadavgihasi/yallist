import type { Claim, Item, ItemStatus } from '@yallist/domain';
import { describe, expect, it } from 'vitest';

import { ringClaim } from './rowActions';

const grill: Item = {
  id: 'grill',
  list: 'bring',
  position: 0,
  name: 'מנגל',
  kind: 'single',
  quantityNeeded: 1,
};
const chairs: Item = { ...grill, id: 'chairs', name: 'כיסאות', kind: 'qty', quantityNeeded: 8 };
const towel: Item = { ...grill, id: 'towel', name: 'מגבת', kind: 'each' };
const claim = (itemId: string, userId: string, quantity = 1): Claim => ({
  itemId,
  userId,
  quantity,
});

describe('ringClaim', () => {
  it('claims an unclaimed item for me, as its button does', () => {
    expect(ringClaim(grill, { kind: 'missing' }, [], 'me')).toBe(1);
    expect(ringClaim({ ...grill, list: 'buy' }, { kind: 'missing' }, [], 'me')).toBe(1);
  });

  it('takes one more of a qty item others started, like the stepper', () => {
    const claims = [claim('chairs', 'ron', 3)];
    expect(ringClaim(chairs, { kind: 'partial', missing: 5 }, claims, 'me')).toBe(1);
  });

  it('says "I have mine" on a per-person item', () => {
    const status: ItemStatus = { kind: 'each', have: 1, total: 2, missingIds: ['me'] };
    expect(ringClaim(towel, status, [claim('towel', 'ron')], 'me')).toBe(1);
  });

  it("is no claim once I have it, someone else has all of it, or it's bought", () => {
    expect(ringClaim(grill, { kind: 'mine' }, [claim('grill', 'me')], 'me')).toBeUndefined();
    const ron = [claim('grill', 'ron')];
    expect(ringClaim(grill, { kind: 'covered', holderIds: ['ron'] }, ron, 'me')).toBeUndefined();
    const mine = [claim('chairs', 'me', 2)];
    expect(ringClaim(chairs, { kind: 'partial', missing: 6 }, mine, 'me')).toBeUndefined();
    const bought = { kind: 'bought', expense: {} } as never;
    expect(ringClaim(grill, bought, [], 'me')).toBeUndefined();
  });
});
