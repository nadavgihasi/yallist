import { findCatalogItem, type Category } from '@yallist/domain';
import { describe, expect, it } from 'vitest';

import type { Action } from '@/state/reducer';

import { fillFromCatalog, NEW, saved, toSave, type Draft } from './addItem';

const add: Action = {
  type: 'addItem',
  item: { list: 'bring', name: 'אוהל', kind: 'single', quantityNeeded: 1, categoryId: null },
  claim: 0,
};

describe('saved', () => {
  it('waits for the API before the sheet may close', async () => {
    let answer: (() => void) | undefined;
    let done = false;
    const save = saved((_, { onSuccess }) => (answer = onSuccess), add).then(() => (done = true));
    await Promise.resolve();
    expect(done).toBe(false);
    answer!();
    await save;
    expect(done).toBe(true);
  });

  it('fails when the API refuses, so the sheet keeps the text', async () => {
    const error = new Error('400');
    await expect(saved((_, { onError }) => onError(error), add)).rejects.toBe(error);
  });
});

const typed = (name: string, list: Draft['list'] = 'bring'): Draft => ({
  list,
  name,
  kind: 'single',
  qty: 4,
  category: undefined,
  newName: '',
});
const light: Category = { id: 'light', list: 'bring', name: 'תאורה וניווט', position: 0 };

describe('toSave', () => {
  it('saves a fully typed catalog name in its category', () => {
    expect(toSave(typed('פנס ראש'), [light], true)).toEqual({
      item: {
        list: 'bring',
        name: 'פנס ראש',
        kind: 'single',
        quantityNeeded: 1,
        categoryId: 'light',
      },
      newCategory: undefined,
    });
    expect(toSave(typed('מים', 'buy'), [], true).newCategory).toBe('שתייה');
  });

  it('saves a typed synonym as the catalog item, with its count', () => {
    expect(toSave(typed('שקי שינה'), [], true)).toEqual({
      item: { list: 'bring', name: 'שק שינה', kind: 'each', quantityNeeded: 1, categoryId: null },
      newCategory: 'לינה',
    });
  });

  it('leaves a name the catalog doesn’t know, or a hand-chosen count, as typed', () => {
    expect(toSave(typed('הסירה של דני'), [light], true).newCategory).toBeUndefined();
    expect(toSave(typed('פנס ראש'), [light], false).item.categoryId).toBeNull();
  });
});

describe('fillFromCatalog', () => {
  it('puts a typed catalog name in its category, the trip’s own when it has one', () => {
    const entry = findCatalogItem('פנס ראש')!;
    expect(fillFromCatalog(typed('פנס ראש'), entry, [light])).toMatchObject({
      name: 'פנס ראש',
      category: 'light',
    });
    expect(fillFromCatalog(typed('פנס ראש'), entry, [])).toMatchObject({
      category: NEW,
      newName: 'תאורה וניווט',
    });
  });

  it('takes the catalog’s count and its name for a synonym', () => {
    const entry = findCatalogItem('גריל')!;
    expect(fillFromCatalog(typed('גריל'), entry, [])).toMatchObject({
      name: 'מנגל',
      kind: entry.kind,
      newName: 'בישול ועל האש',
    });
    const each = findCatalogItem('שק שינה')!;
    expect(each.kind).toBe('each');
    expect(fillFromCatalog(typed('שק שינה'), each, []).kind).toBe('each');
  });

  it('keeps a category already picked on the list', () => {
    const mine: Category = { id: 'mine', list: 'bring', name: 'שלי', position: 1 };
    const draft = { ...typed('פנס ראש'), category: 'mine' };
    expect(fillFromCatalog(draft, findCatalogItem('פנס ראש')!, [mine]).category).toBe('mine');
  });
});
