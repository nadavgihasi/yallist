import type { BagEntry, Item } from '@yallist/domain';
import { describe, expect, it } from 'vitest';

import { bagLabel, bagName } from './bag';

const item = (over: Partial<Item> = {}): Item => ({
  id: 'i',
  list: 'bring',
  position: 0,
  name: 'מצננת',
  kind: 'single',
  quantityNeeded: 1,
  ...over,
});
const entry = (over: Partial<BagEntry> = {}): BagEntry => ({
  item: item(),
  quantity: 1,
  packed: false,
  source: 'list',
  ...over,
});

describe('bagLabel', () => {
  it('says where each entry comes from, and that it is packed', () => {
    expect(bagLabel(entry())).toBe('אצלך · מהרשימה');
    expect(bagLabel(entry({ source: 'each' }))).toBe('אחד לכל אחד · מהרשימה');
    expect(bagLabel(entry({ source: 'bought', packed: true }))).toBe('קנית · מהקניות · ארוז');
  });

  it('gives a private item no source, only packed', () => {
    expect(bagLabel(entry({ source: 'private' }))).toBe('');
    expect(bagLabel(entry({ source: 'private', packed: true }))).toBe('ארוז');
  });
});

describe('bagName', () => {
  it('shows my part of a qty item', () => {
    expect(bagName(entry({ item: item({ name: 'כיסאות', kind: 'qty' }), quantity: 4 }))).toBe(
      'כיסאות ×4',
    );
    expect(bagName(entry())).toBe('מצננת');
  });
});
