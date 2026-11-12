import { formatShekel, splitEqually, type Expense, type Item } from '@yallist/domain';
import { describe, expect, it, vi } from 'vitest';

import type { TripData } from '@/state/types';

import { deriveTrip } from './derive';
import { buyItemText, perPersonText, statusLine } from './labels';

// The theme pulls in react-native, which these unit tests don't run.
vi.mock('@/theme', () => ({ colors: {} }));

describe('perPersonText', () => {
  it("shows both shares when they differ by an agora: each one somebody's real share", () => {
    // ₪412.90 between 3: 137.64 + 137.63 + 137.63, the split the money tab's "החלק שלך" uses.
    const text = perPersonText(41290, 3);
    expect(text).toBe('₪137.63 או ₪137.64');
    const shares = [...splitEqually(41290, ['a', 'b', 'c']).values()];
    expect(shares.reduce((a, b) => a + b, 0)).toBe(41290);
    for (const share of shares) expect(text).toContain(formatShekel(share));
  });

  it('shows one amount when everyone pays the same', () => {
    expect(perPersonText(9000, 3)).toBe('₪30.00');
    expect(perPersonText(41290, 1)).toBe('₪412.90');
  });

  it('has nothing to show without an amount or anyone to split with', () => {
    expect(perPersonText(undefined, 3)).toBeUndefined();
    expect(perPersonText(41290, 0)).toBeUndefined();
  });
});

describe('statusLine for a bought item', () => {
  const items: Item[] = Array.from({ length: 8 }, (_, i) => ({
    id: `i${i}`,
    list: 'buy',
    position: i,
    name: i === 0 ? 'חומוס' : `פריט ${i}`,
    kind: 'single',
    quantityNeeded: 1,
  }));
  const run = (paidBy: string): Expense => ({
    id: 'run',
    itemIds: items.map((i) => i.id),
    description: 'קניות · 8 פריטים',
    amountAgorot: 41290,
    paidBy,
    shares: ['me', 'ron'],
  });
  const line = (expense: Expense, item = items[0]!) => {
    const data = {
      members: ['me', 'ron'].map((userId) => ({
        userId,
        displayName: userId === 'ron' ? 'רון' : 'נדב',
        role: 'member',
        status: 'active',
        color: '#FFD9C2',
      })),
      items,
      claims: [],
      expenses: [expense],
      runs: [],
      transfers: [],
    } as unknown as TripData;
    const view = deriveTrip(data, 'me');
    return statusLine(item, view.status(item), [], view, 'me');
  };

  it("says it was part of a shopping run, not that the run's total was its price", () => {
    expect(line(run('ron'))).toEqual({
      label: 'נקנה',
      detail: 'בקנייה של רון: 8 פריטים, ₪412.90',
      tone: 'success',
    });
    expect(line(run('me')).detail).toBe('בקנייה שלך: 8 פריטים, ₪412.90');
  });

  it("still says so once the run's other items are deleted", () => {
    const left: Expense = { ...run('ron'), itemIds: ['i0'], itemCount: 8 };
    expect(line(left).detail).toBe('בקנייה של רון: 8 פריטים, ₪412.90');
    expect(line({ ...left, paidBy: 'me' }).detail).toBe('בקנייה שלך: 8 פריטים, ₪412.90');
  });

  it('shows the price of an item bought on its own', () => {
    const alone: Expense = { ...run('ron'), itemIds: ['i0'], amountAgorot: 1290 };
    expect(line(alone).detail).toBe('₪12.90, רון');
  });
});

describe('buyItemText', () => {
  const buy = (over: Partial<Item>): Item => ({
    id: 'i',
    list: 'buy',
    position: 0,
    name: 'Coca Cola',
    kind: 'single',
    quantityNeeded: 1,
    ...over,
  });

  it('keeps an English name and the amount each in its own direction', () => {
    // RLI name PDI, then FSI amount PDI: the `2` doesn't join `Coca Cola`; a no-break space keeps
    // the amount on one line.
    expect(buyItemText(buy({ displayQty: '2 ליטר' }), ' · ')).toBe(
      '\u2067Coca Cola\u2069 · \u20682\u00a0ליטר\u2069',
    );
  });

  it('is the name alone without an amount', () => {
    expect(buyItemText(buy({}), ' ')).toBe('Coca Cola');
  });
});
