import { BULK_MAX_ITEMS } from '@yallist/domain';
import { describe, expect, it } from 'vitest';

import { bulkEntries, bulkSummary, isPicked, togglePicked } from './bulkState';

const trip = [
  { list: 'bring' as const, name: 'מנגל' },
  { list: 'buy' as const, name: 'קרח' },
];

describe('bulkEntries', () => {
  it('previews typed lines, then ticked suggestions, filled in from the catalog', () => {
    const entries = bulkEntries('מחצלת\nכיסאות ×4, גריל', ['מלקחיים', 'קרח'], 'bring', trip);
    expect(entries.map((e) => [e.item.name, e.item.list, e.item.quantityNeeded, e.status])).toEqual(
      [
        ['מחצלת', 'bring', 1, 'add'],
        ['כיסאות', 'bring', 4, 'add'],
        // A synonym of what the list has.
        ['מנגל', 'bring', 1, 'exists'],
        ['מלקחיים', 'bring', 1, 'add'],
        // The catalog's list: קרח is bought, and the buy list has it.
        ['קרח', 'buy', 1, 'exists'],
      ],
    );
    expect(entries[0]!.item.category).toBe('ישיבה וצל');
    expect(entries[1]!.item.category).toBeNull();
  });

  it('marks something typed and ticked as a repeat', () => {
    const entries = bulkEntries('מלקחיים', ['מלקחיים'], 'bring', []);
    expect(entries.map((e) => e.status)).toEqual(['add', 'repeat']);
  });

  it('is empty for nothing typed or ticked', () => {
    expect(bulkEntries('  \n,', [], 'bring', trip)).toEqual([]);
  });
});

describe('bulkSummary', () => {
  it('counts what goes in and what the lists have', () => {
    expect(bulkSummary(bulkEntries('מחצלת\nגריל\nגריל\nכיסא', [], 'bring', trip))).toEqual({
      add: 2,
      exists: 2,
      tooMany: false,
    });
  });

  it('says when it is more than one request takes', () => {
    const text = (n: number) => Array.from({ length: n }, (_, i) => `פריט ${i}`).join('\n');
    expect(bulkSummary(bulkEntries(text(BULK_MAX_ITEMS), [], 'bring', [])).tooMany).toBe(false);
    expect(bulkSummary(bulkEntries(text(BULK_MAX_ITEMS + 1), [], 'bring', [])).tooMany).toBe(true);
  });
});

describe('togglePicked', () => {
  it('ticks and unticks, in the order ticked', () => {
    let picked = togglePicked([], 'מלקחיים');
    picked = togglePicked(picked, 'מטקות');
    expect(picked).toEqual(['מלקחיים', 'מטקות']);
    expect(isPicked(picked, 'מטקות')).toBe(true);
    expect(togglePicked(picked, 'מלקחיים')).toEqual(['מטקות']);
  });

  it('treats a synonym as the same suggestion', () => {
    expect(isPicked(['מנגל'], 'גריל')).toBe(true);
    expect(togglePicked(['מנגל'], 'גריל')).toEqual([]);
  });
});
