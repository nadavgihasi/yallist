import { describe, expect, it } from 'vitest';

import { copyEntries, copyGroups, copyPicked, copySources } from './copyState';

const trip = (id: string, startsOn: string, itemCount: number) => ({
  trip: { id, name: id, startsOn, endsOn: startsOn },
  itemCount,
});

describe('copySources', () => {
  it('lists my other trips with items, the latest first', () => {
    const trips = [
      trip('old', '2025-06-01', 4),
      trip('this', '2026-11-20', 0),
      trip('empty', '2026-01-01', 0),
      trip('last', '2026-08-01', 12),
    ];
    expect(copySources(trips, 'this').map((t) => t.trip.id)).toEqual(['last', 'old']);
  });
});

describe('copyEntries', () => {
  const source = {
    categories: [
      { id: 'c1', list: 'bring' as const, name: 'ישיבה', position: 0 },
      { id: 'c2', list: 'buy' as const, name: 'פירות', position: 0 },
    ],
    items: [
      {
        id: 'b',
        list: 'buy' as const,
        categoryId: 'c2',
        position: 0,
        name: 'אבטיח',
        kind: 'single' as const,
        quantityNeeded: 1,
        displayQty: '2 גדולים',
        note: 'מהשוק',
      },
      {
        id: 'a2',
        list: 'bring' as const,
        position: 1,
        name: 'מנגל',
        kind: 'single' as const,
        quantityNeeded: 1,
      },
      {
        id: 'a1',
        list: 'bring' as const,
        categoryId: 'c1',
        position: 0,
        name: 'כיסאות',
        kind: 'qty' as const,
        quantityNeeded: 6,
      },
    ],
  };

  it('copies what each item is, in list order, against what this trip has', () => {
    const entries = copyEntries(source, [{ list: 'bring', name: 'גריל' }]);
    expect(entries).toEqual([
      {
        id: 'a1',
        status: 'add',
        item: {
          list: 'bring',
          name: 'כיסאות',
          kind: 'qty',
          quantityNeeded: 6,
          unit: null,
          displayQty: null,
          category: 'ישיבה',
        },
      },
      expect.objectContaining({ id: 'a2', status: 'exists' }),
      {
        id: 'b',
        status: 'add',
        // No note: that was the other trip's.
        item: {
          list: 'buy',
          name: 'אבטיח',
          kind: 'single',
          quantityNeeded: 1,
          unit: null,
          displayQty: '2 גדולים',
          category: 'פירות',
        },
      },
    ]);
  });

  it('starts with all of it picked but what this trip has; unticking leaves it out', () => {
    const entries = copyEntries(source, [{ list: 'bring', name: 'מנגל' }]);
    expect(copyPicked(entries, new Set())).toEqual(['a1', 'b']);
    expect(copyPicked(entries, new Set(['b']))).toEqual(['a1']);
  });

  it('groups by list, bring first', () => {
    const groups = copyGroups(copyEntries(source, []));
    expect(groups.map((g) => [g.list, g.entries.map((e) => e.id)])).toEqual([
      ['bring', ['a1', 'a2']],
      ['buy', ['b']],
    ]);
  });
});
