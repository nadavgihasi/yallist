import { describe, expect, it } from 'vitest';

import {
  BULK_MAX_ITEMS,
  bulkItemFor,
  bulkToAdd,
  ITEM_NAME_MAX,
  parseBulkLine,
  parseBulkText,
  planBulkAdd,
  type BulkItem,
} from './bulk';

describe('parseBulkText', () => {
  it('takes one item per line and splits on commas', () => {
    expect(parseBulkText('מחצלת\nפחמים, מצית\r\nקרח')).toEqual([
      { name: 'מחצלת' },
      { name: 'פחמים' },
      { name: 'מצית' },
      { name: 'קרח' },
    ]);
  });

  it('drops blank lines, empty parts and extra spaces', () => {
    expect(parseBulkText('\n\n  מחצלת  \n , ,\n   \nכיסא   קמפינג\n')).toEqual([
      { name: 'מחצלת' },
      { name: 'כיסא קמפינג' },
    ]);
    expect(parseBulkText('')).toEqual([]);
    expect(parseBulkText(' \n , ')).toEqual([]);
  });

  it('reads a count written after the name', () => {
    for (const text of [
      'כיסאות ×4',
      'כיסאות x4',
      'כיסאות X4',
      'כיסאות×4',
      'כיסאות * 4',
      'כיסאות 4x',
    ]) {
      expect(parseBulkLine(text), text).toEqual({ name: 'כיסאות', quantity: 4 });
    }
  });

  it('reads a count written before the name', () => {
    for (const text of ['4 כיסאות', '4x כיסאות', '4 × כיסאות', '×4 כיסאות', 'x4 כיסאות']) {
      expect(parseBulkLine(text), text).toEqual({ name: 'כיסאות', quantity: 4 });
    }
  });

  it('takes list markers off, without reading a numbered list as counts', () => {
    expect(parseBulkText('- מחצלת\n• פחמים\n1. מצית\n2) קרח ×2')).toEqual([
      { name: 'מחצלת' },
      { name: 'פחמים' },
      { name: 'מצית' },
      { name: 'קרח', quantity: 2 },
    ]);
  });

  it('keeps digits that are part of the name', () => {
    expect(parseBulkLine('7up')).toEqual({ name: '7up' });
    expect(parseBulkLine('סוללות AA')).toEqual({ name: 'סוללות AA' });
    expect(parseBulkLine('Box2')).toEqual({ name: 'Box2' });
  });

  it('keeps counts between 1 and 999', () => {
    expect(parseBulkLine('כיסאות ×0')).toEqual({ name: 'כיסאות', quantity: 1 });
    expect(parseBulkLine('כיסאות ×5000')).toEqual({ name: 'כיסאות', quantity: 999 });
  });

  it('keeps over-long names whole, for the preview to flag', () => {
    const long = 'א'.repeat(ITEM_NAME_MAX + 5);
    expect(parseBulkText(long)).toEqual([{ name: long }]);
  });
});

describe('bulkItemFor', () => {
  it('fills in a catalog item by its name or a synonym', () => {
    expect(bulkItemFor({ name: 'גריל' }, 'buy')).toEqual({
      list: 'bring',
      name: 'מנגל',
      kind: 'single',
      quantityNeeded: 1,
      category: 'בישול ועל האש',
    });
    expect(bulkItemFor({ name: 'שקי שינה' }, 'bring')).toMatchObject({
      name: 'שק שינה',
      kind: 'each',
      quantityNeeded: 1,
    });
  });

  it('lets a written count win over the catalog', () => {
    expect(bulkItemFor({ name: 'שק שינה', quantity: 3 }, 'bring')).toMatchObject({
      kind: 'qty',
      quantityNeeded: 3,
    });
    expect(bulkItemFor({ name: 'שק שינה', quantity: 1 }, 'bring')).toMatchObject({
      kind: 'single',
      quantityNeeded: 1,
    });
  });

  it('adds what the catalog doesn’t know to the list, uncategorized', () => {
    expect(bulkItemFor({ name: 'הקלפים של סבתא' }, 'bring')).toEqual({
      list: 'bring',
      name: 'הקלפים של סבתא',
      kind: 'single',
      quantityNeeded: 1,
      category: null,
    });
    expect(bulkItemFor({ name: 'דבר חדש', quantity: 6 }, 'buy')).toMatchObject({
      list: 'buy',
      kind: 'qty',
      quantityNeeded: 6,
    });
  });
});

describe('planBulkAdd', () => {
  const item = (name: string, list: BulkItem['list'] = 'bring'): BulkItem => ({
    list,
    name,
    kind: 'single',
    quantityNeeded: 1,
    category: null,
  });

  it('skips what the list has, by name or synonym, and repeats within the batch', () => {
    const entries = planBulkAdd(
      [item('גריל'), item('מחצלת'), item('מחצלות'), item('כיסא'), item('מנגל', 'buy')],
      [{ list: 'bring', name: 'מנגל' }],
    );
    expect(entries.map((e) => e.status)).toEqual(['exists', 'add', 'repeat', 'add', 'add']);
    expect(bulkToAdd(entries).map((i) => i.name)).toEqual(['מחצלת', 'כיסא', 'מנגל']);
  });

  it('flags over-long names', () => {
    const [entry] = planBulkAdd([item('א'.repeat(ITEM_NAME_MAX + 1))], []);
    expect(entry!.status).toBe('tooLong');
  });

  it('plans any number; the cap is for the caller to enforce', () => {
    const many = Array.from({ length: BULK_MAX_ITEMS + 1 }, (_, i) => item(`פריט ${i}`));
    expect(bulkToAdd(planBulkAdd(many, []))).toHaveLength(BULK_MAX_ITEMS + 1);
  });
});
