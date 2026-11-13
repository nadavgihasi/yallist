import { afterEach, describe, expect, it } from 'vitest';

import {
  clearReveal,
  expenseKey,
  itemKey,
  pendingReveal,
  requestReveal,
  revealOffset,
  revealTarget,
} from './reveal';

const data = {
  items: [
    { id: 'i1', list: 'bring' as const, name: 'מנגל' },
    { id: 'i2', list: 'buy' as const, name: 'מנגל' },
  ],
  expenses: [
    { id: 'e1', description: 'פחמים', amountAgorot: 4500 },
    { id: 'e2', description: 'פחמים', amountAgorot: 4500 },
  ],
};

describe('revealTarget', () => {
  it('finds an item by its list and name, on its own tab', () => {
    expect(revealTarget({ kind: 'item', list: 'buy', name: 'מנגל' }, data)).toEqual({
      tab: 'buy',
      key: itemKey('buy', 'מנגל'),
      itemId: 'i2',
    });
  });

  it("waits for an item that isn't there yet", () => {
    expect(revealTarget({ kind: 'item', list: 'bring', name: 'פנס' }, data)).toBeUndefined();
  });

  it('finds the new expense, not an older one just like it', () => {
    const reveal = {
      kind: 'expense' as const,
      description: 'פחמים',
      amountAgorot: 4500,
      before: ['e1'],
    };
    expect(revealTarget(reveal, data)).toEqual({ tab: 'money', key: expenseKey('e2') });
    expect(revealTarget({ ...reveal, before: ['e1', 'e2'] }, data)).toBeUndefined();
  });
});

describe('requestReveal', () => {
  afterEach(clearReveal);

  it('is for its own trip, until it is cleared or goes stale', () => {
    requestReveal('t1', { kind: 'item', list: 'bring', name: 'פנס' }, 1000);
    expect(pendingReveal('t2', 1000)).toBeUndefined();
    expect(pendingReveal('t1', 2000)).toMatchObject({ name: 'פנס' });
    expect(pendingReveal('t1', 1000 + 15_000)).toBeUndefined();
    clearReveal();
    expect(pendingReveal('t1', 2000)).toBeUndefined();
  });
});

describe('revealOffset', () => {
  it('centers the row in what the pinned bar leaves visible', () => {
    // Visible from 150 to 850: its middle, 500, lands on the row's middle, 1220.
    expect(revealOffset({ rowY: 1200, rowHeight: 40, viewport: 850, coveredTop: 150 })).toBe(720);
  });

  it('never scrolls above the top', () => {
    expect(revealOffset({ rowY: 100, rowHeight: 40, viewport: 850, coveredTop: 150 })).toBe(0);
  });
});
