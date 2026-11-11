import { describe, expect, it } from 'vitest';

import { bagItemFor, bagSuggestions, broughtNotInBag } from './bag';
import type { BagItem, Claim, Item } from './types';

const item = (over: Partial<Item> & Pick<Item, 'id'>): Item => ({
  list: 'bring',
  position: 0,
  name: over.id,
  kind: 'single',
  quantityNeeded: 1,
  ...over,
});
const claim = (itemId: string, userId: string, extra: Partial<Claim> = {}): Claim => ({
  itemId,
  userId,
  quantity: 1,
  ...extra,
});
const bagOf = (...entries: [string, number?][]): BagItem[] =>
  entries.map(([name, quantity = 1]) => ({ id: name, name, quantity }));

describe('bagItemFor', () => {
  it('matches the exact name only', () => {
    const bag = bagOf(['גזייה']);
    expect(bagItemFor(bag, 'גזייה')).toBe(bag[0]);
    expect(bagItemFor(bag, 'גזיה')).toBeUndefined();
  });
});

describe('bagSuggestions', () => {
  const stove = item({ id: 'גזייה' });
  const chairs = item({ id: 'כיסא', kind: 'qty', quantityNeeded: 4 });
  const bag = bagOf(['גזייה'], ['כיסא', 2], ['שק שינה'], ['פחמים']);

  it('offers common bring items in my bag that nobody brings yet', () => {
    const items = [
      stove,
      chairs,
      item({ id: 'שק שינה', kind: 'each' }),
      item({ id: 'פחמים', list: 'buy' }),
      item({ id: 'אוהל' }),
    ];
    expect(bagSuggestions(items, [], bag)).toEqual([
      { item: stove, quantity: 1 },
      // As many as the bag has, up to what's needed.
      { item: chairs, quantity: 2 },
    ]);
    expect(bagSuggestions([chairs], [], bagOf(['כיסא', 9]))).toEqual([
      { item: chairs, quantity: 4 },
    ]);
  });

  it('never offers what someone already took, even in part', () => {
    expect(bagSuggestions([stove, chairs], [claim('כיסא', 'dana')], bag)).toEqual([
      { item: stove, quantity: 1 },
    ]);
  });
});

describe('broughtNotInBag', () => {
  it("lists what I said I have or took, once per name, that isn't in my bag", () => {
    const items = [
      item({ id: 'בגד ים', kind: 'each' }),
      item({ id: 'כובע', kind: 'each' }),
      item({ id: 'פחמים', kind: 'qty', quantityNeeded: 3 }),
      item({ id: 'פנס' }),
      item({ id: 'אוהל' }),
      item({ id: 'חומוס', list: 'buy' }),
      item({ id: 'פחמים2', name: 'פחמים' }),
    ];
    const claims = [
      claim('בגד ים', 'me'),
      claim('כובע', 'me', { fromBag: true }),
      claim('פחמים', 'me', { quantity: 2 }),
      claim('פחמים2', 'me'),
      claim('פנס', 'me'),
      claim('אוהל', 'dana'),
      claim('חומוס', 'me'),
    ];
    expect(broughtNotInBag(items, claims, bagOf(['פנס']), 'me')).toEqual([
      { name: 'בגד ים', quantity: 1 },
      { name: 'פחמים', quantity: 2 },
    ]);
  });
});
