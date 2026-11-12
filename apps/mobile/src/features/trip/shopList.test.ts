import type { Category, Claim, Item } from '@yallist/domain';
import { describe, expect, it } from 'vitest';

import { shopList } from './shopList';

const category = (id: string, position: number, list: Category['list'] = 'buy'): Category => ({
  id,
  list,
  name: id,
  position,
});
const item = (id: string, position: number, categoryId?: string): Item => ({
  id,
  list: 'buy',
  categoryId,
  position,
  name: id,
  kind: 'single',
  quantityNeeded: 1,
});
const inRun = (itemId: string, inCart = false): Claim => ({
  itemId,
  userId: 'me',
  quantity: 1,
  runId: 'run',
  inCart: inCart || undefined,
});

const categories = [category('drinks', 1), category('meat', 0), category('gear', 0, 'bring')];
const items = [
  item('cola', 0, 'drinks'),
  item('steak', 1, 'meat'),
  item('water', 2, 'drinks'),
  item('ice', 3),
  item('kebab', 4, 'meat'),
];

const names = (list: readonly Item[]) => list.map((i) => i.id);

describe('shopList', () => {
  it("groups the run's items by category, in the buy list's order, uncategorized last", () => {
    const { groups, inCart } = shopList(
      items.map((i) => inRun(i.id)),
      items,
      categories,
    );
    expect(groups.map((g) => [g.category?.id, names(g.items)])).toEqual([
      ['meat', ['steak', 'kebab']],
      ['drinks', ['cola', 'water']],
      [undefined, ['ice']],
    ]);
    expect(inCart).toEqual([]);
  });

  it('sinks ticked items into the cart section, and leaves out empty groups', () => {
    const claims = [inRun('cola', true), inRun('water', true), inRun('steak'), inRun('ice')];
    const { groups, inCart } = shopList(claims, items, categories);
    expect(groups.map((g) => [g.category?.id, names(g.items)])).toEqual([
      ['meat', ['steak']],
      [undefined, ['ice']],
    ]);
    expect(names(inCart)).toEqual(['cola', 'water']);
  });

  it('shows an item added during the run once the run has it', () => {
    const withNew = [...items, item('lighter', 9)];
    const before = shopList([inRun('steak')], withNew, categories);
    expect(before.groups.map((g) => names(g.items))).toEqual([['steak']]);
    const after = shopList([inRun('steak'), inRun('lighter')], withNew, categories);
    expect(after.groups.map((g) => names(g.items))).toEqual([['steak'], ['lighter']]);
  });

  it('puts an item of a deleted category with the uncategorized ones', () => {
    const { groups } = shopList([inRun('cola')], items, [category('meat', 0)]);
    expect(groups).toEqual([{ category: undefined, items: [items[0]] }]);
  });
});
