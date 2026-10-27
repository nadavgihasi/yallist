import { describe, expect, it } from 'vitest';

import { isRunEligible, perPersonPreview, runSummary } from './shopping';
import type { Claim, Expense, Item } from './types';

const item = (id: string, position: number, over: Partial<Item> = {}): Item => ({
  id,
  list: 'buy',
  position,
  name: id,
  kind: 'single',
  quantityNeeded: 1,
  ...over,
});
const bought = (itemIds: string[]): Expense => ({
  id: 'e',
  itemIds,
  description: '',
  amountAgorot: 100,
  paidBy: 'ron',
  shares: ['ron'],
});

describe('isRunEligible', () => {
  it('takes unclaimed, unbought, shared buy items only', () => {
    const claims: Claim[] = [{ itemId: 'taken', userId: 'ron', quantity: 1 }];
    expect(isRunEligible(item('free', 0), claims, [])).toBe(true);
    expect(isRunEligible(item('taken', 1), claims, [])).toBe(false);
    expect(isRunEligible(item('free', 0), [], [bought(['x', 'free'])])).toBe(false);
    expect(isRunEligible(item('tent', 0, { list: 'bring' }), [], [])).toBe(false);
    expect(isRunEligible(item('snacks', 0, { kind: 'each' }), [], [])).toBe(false);
    expect(isRunEligible(item('gum', 0, { privateOwnerId: 'ron' }), [], [])).toBe(false);
  });
});

describe('runSummary', () => {
  const items = [item('water', 2), item('eggs', 0), item('coffee', 1)];

  it('splits the run by cart, in list order', () => {
    const claims: Claim[] = [
      { itemId: 'water', userId: 'me', quantity: 1, runId: 'r', inCart: true },
      { itemId: 'coffee', userId: 'me', quantity: 1, runId: 'r' },
      { itemId: 'eggs', userId: 'me', quantity: 1, runId: 'r', inCart: true },
    ];
    const { inCart, notInCart } = runSummary(claims, items);
    expect(inCart.map((i) => i.id)).toEqual(['eggs', 'water']);
    expect(notInCart.map((i) => i.id)).toEqual(['coffee']);
  });

  it('drops items that are no longer on the list', () => {
    const claims: Claim[] = [
      { itemId: 'deleted', userId: 'me', quantity: 1, runId: 'r', inCart: true },
    ];
    expect(runSummary(claims, items)).toEqual({ inCart: [], notInCart: [] });
  });
});

describe('perPersonPreview', () => {
  it('is the largest equal share, so nobody pays more than it shows', () => {
    expect(perPersonPreview(48690, 8)).toBe(6087); // 6086.25 → 6087 for two of them
    expect(perPersonPreview(900, 3)).toBe(300);
    expect(perPersonPreview(1, 3)).toBe(1);
  });

  it('has nothing to show without an amount or anyone to split with', () => {
    expect(perPersonPreview(0, 3)).toBeUndefined();
    expect(perPersonPreview(900, 0)).toBeUndefined();
  });
});
