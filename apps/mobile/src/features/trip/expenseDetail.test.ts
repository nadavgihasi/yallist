import type { Item } from '@yallist/domain';
import { describe, expect, it } from 'vitest';

import { coveredItems, owedLines } from './expenseDetail';

describe('owedLines', () => {
  const members = ['a', 'b', 'c', 'me'];

  it('puts me first, then members in order, and adds up to the total', () => {
    const lines = owedLines({ amountAgorot: 1000, shares: ['c', 'me', 'a'] }, members, 'me');
    expect(lines.map((l) => l.userId)).toEqual(['me', 'a', 'c']);
    expect(lines.reduce((sum, l) => sum + l.owed, 0)).toBe(1000);
  });

  it('counts each part for its own people', () => {
    const lines = owedLines(
      {
        amountAgorot: 30000,
        shares: ['a', 'b', 'c'],
        parts: [{ label: 'יין', amountAgorot: 6000, shares: ['a', 'b'] }],
      },
      members,
      'me',
    );
    // 60 between a and b, the 240 left between all three.
    expect(lines).toEqual([
      { userId: 'a', owed: 11000 },
      { userId: 'b', owed: 11000 },
      { userId: 'c', owed: 8000 },
    ]);
  });

  it('keeps someone who left, after the members', () => {
    const lines = owedLines({ amountAgorot: 200, shares: ['gone', 'b'] }, members, 'me');
    expect(lines.map((l) => l.userId)).toEqual(['b', 'gone']);
  });
});

describe('coveredItems', () => {
  const item = (id: string): Item => ({
    id,
    list: 'buy',
    position: 0,
    name: id,
    kind: 'single',
    quantityNeeded: 1,
  });

  it('names what is still on the list and counts what was deleted', () => {
    const result = coveredItems({ itemIds: ['x', 'y'], itemCount: 3 }, [item('x'), item('y')]);
    expect(result.items.map((i) => i.id)).toEqual(['x', 'y']);
    expect(result.deleted).toBe(1);
    expect(coveredItems({}, [item('x')])).toEqual({ items: [], deleted: 0 });
  });
});
