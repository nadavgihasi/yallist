import { describe, expect, it } from 'vitest';

import { claimCap, filterItems, isDone, isOnMyList, itemStatus } from './coverage';
import type { Claim, Expense, Item } from './types';

const item = (over: Partial<Item> & Pick<Item, 'id'>): Item => ({
  list: 'bring',
  position: 0,
  name: over.id,
  kind: 'single',
  quantityNeeded: 1,
  ...over,
});
const claim = (itemId: string, userId: string, quantity = 1): Claim => ({
  itemId,
  userId,
  quantity,
});
const active = ['me', 'ron', 'dana'];

describe('itemStatus', () => {
  it('missing when nobody claimed', () => {
    expect(itemStatus(item({ id: 'grill' }), [], [], active, 'me')).toEqual({ kind: 'missing' });
  });

  it('mine when I took a single item', () => {
    expect(itemStatus(item({ id: 'grill' }), [claim('grill', 'me')], [], active, 'me')).toEqual({
      kind: 'mine',
    });
  });

  it('covered by others on the bring list, in progress on the buy list', () => {
    const claims = [claim('x', 'ron')];
    expect(itemStatus(item({ id: 'x' }), claims, [], active, 'me')).toEqual({
      kind: 'covered',
      holderIds: ['ron'],
    });
    expect(itemStatus(item({ id: 'x', list: 'buy' }), claims, [], active, 'me')).toEqual({
      kind: 'inProgress',
      holderIds: ['ron'],
    });
  });

  it('a fully claimed qty item that includes me is covered, not mine', () => {
    const chairs = item({ id: 'chairs', kind: 'qty', quantityNeeded: 4 });
    const claims = [claim('chairs', 'me', 2), claim('chairs', 'ron', 2)];
    expect(itemStatus(chairs, claims, [], active, 'me')).toEqual({
      kind: 'covered',
      holderIds: ['me', 'ron'],
    });
  });

  it('ignores claims from members who are no longer active for each items', () => {
    const bag = item({ id: 'bag', kind: 'each' });
    const claims = [claim('bag', 'me'), claim('bag', 'ron'), claim('bag', 'gone')];
    expect(itemStatus(bag, claims, [], ['me', 'ron'], 'me').kind).toBe('covered');
  });

  it('partial for qty items', () => {
    const chairs = item({ id: 'chairs', kind: 'qty', quantityNeeded: 8 });
    expect(
      itemStatus(chairs, [claim('chairs', 'me', 3), claim('chairs', 'ron', 2)], [], active, 'me'),
    ).toEqual({
      kind: 'partial',
      missing: 3,
    });
  });

  it('counts each items against active members', () => {
    const bag = item({ id: 'bag', kind: 'each' });
    expect(itemStatus(bag, [claim('bag', 'ron')], [], active, 'me')).toEqual({
      kind: 'each',
      have: 1,
      total: 3,
      missingIds: ['me', 'dana'],
    });
    const all = active.map((u) => claim('bag', u));
    expect(itemStatus(bag, all, [], active, 'me').kind).toBe('covered');
  });

  it('bought when an expense links to a buy item', () => {
    const exp: Expense = {
      id: 'e',
      itemId: 'meat',
      description: '',
      amountAgorot: 45000,
      paidBy: 'dana',
      shares: active,
    };
    expect(itemStatus(item({ id: 'meat', list: 'buy' }), [], [exp], active, 'me')).toEqual({
      kind: 'bought',
      expense: exp,
    });
  });
});

describe('isDone / filterItems', () => {
  const items = [item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c', list: 'buy' })];
  const claims = [claim('a', 'me'), claim('c', 'ron')];

  it('counts claimed (in progress) and bought items as done', () => {
    expect(isDone(items[2]!, claims, [], active)).toBe(true);
    expect(isDone(items[1]!, claims, [], active)).toBe(false);
    const bought: Expense = {
      id: 'e',
      itemId: 'c',
      description: '',
      amountAgorot: 100,
      paidBy: 'ron',
      shares: active,
    };
    expect(isDone(items[2]!, [], [bought], active)).toBe(true);
    expect(isDone(items[2]!, [], [], active)).toBe(false);
  });

  it('filters', () => {
    const ids = (f: 'all' | 'missing' | 'mine') =>
      filterItems(items, f, claims, [], active, 'me').map((i) => i.id);
    expect(ids('all')).toEqual(['a', 'b', 'c']);
    expect(ids('missing')).toEqual(['b']);
    expect(ids('mine')).toEqual(['a']);
  });

  it('puts every "each" item on my list, whether or not I have mine yet', () => {
    const bag = item({ id: 'bag', kind: 'each' });
    const hat = item({ id: 'hat', kind: 'each', list: 'buy' });
    const all = [...items, bag, hat];
    const mine = (cl: Claim[]) => filterItems(all, 'mine', cl, [], active, 'me').map((i) => i.id);
    expect(mine(claims)).toEqual(['a', 'bag', 'hat']);
    expect(mine([...claims, claim('bag', 'me')])).toEqual(['a', 'bag', 'hat']);
    expect(mine([])).toEqual(['bag', 'hat']);
    expect(mine([claim('bag', 'ron'), claim('b', 'ron')])).toEqual(['bag', 'hat']);
  });
});

describe('isOnMyList', () => {
  it('holds for "each" items and for what I claimed, whoever else has a share', () => {
    const tent = item({ id: 'tent', kind: 'qty', quantityNeeded: 3 });
    expect(isOnMyList(item({ id: 'bag', kind: 'each' }), [], 'me')).toBe(true);
    expect(isOnMyList(tent, [claim('tent', 'ron', 2)], 'me')).toBe(false);
    expect(isOnMyList(tent, [claim('tent', 'ron', 2), claim('tent', 'me')], 'me')).toBe(true);
    expect(isOnMyList(item({ id: 'grill' }), [claim('grill', 'ron')], 'me')).toBe(false);
  });
});

describe('claimCap', () => {
  it('caps each items at 1 and never goes negative', () => {
    expect(claimCap(item({ id: 'bag', kind: 'each' }), [], 'me')).toBe(1);
    const tent = item({ id: 'tent', kind: 'qty', quantityNeeded: 2 });
    expect(claimCap(tent, [claim('tent', 'ron', 3)], 'me')).toBe(0);
  });

  it('leaves room only for the unclaimed part', () => {
    const chairs = item({ id: 'chairs', kind: 'qty', quantityNeeded: 8 });
    const claims = [claim('chairs', 'me', 3), claim('chairs', 'ron', 2)];
    expect(claimCap(chairs, claims, 'me')).toBe(6);
    expect(claimCap(chairs, claims, 'dana')).toBe(3);
  });
});
