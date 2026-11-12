import { describe, expect, it } from 'vitest';

import {
  CATALOG,
  CATALOG_CATEGORIES,
  heldCatalogNames,
  catalogIcon,
  findCatalogItem,
  itemKey,
  normalizeName,
  parseCatalog,
  sameItem,
  searchCatalog,
} from './catalog';
import { TEMPLATES } from './templates';

describe('CATALOG', () => {
  it('has a unique name, an icon and a known category for every item', () => {
    const names = new Set<string>();
    const known = new Set(CATALOG_CATEGORIES.map((c) => c.name));
    for (const item of CATALOG) {
      expect(names.has(item.name), `duplicate: ${item.name}`).toBe(false);
      names.add(item.name);
      expect(item.icon, item.name).toBeTruthy();
      expect(known.has(item.category), item.name).toBe(true);
      expect(item.name.length).toBeLessThanOrEqual(80);
    }
    expect(CATALOG.length).toBeGreaterThanOrEqual(5000);
  });

  it('has items in every category', () => {
    for (const c of CATALOG_CATEGORIES)
      expect(
        CATALOG.some((i) => i.category === c.name),
        c.name,
      ).toBe(true);
  });

  it('fits the quantity rules of an item', () => {
    for (const item of CATALOG) {
      if (item.kind === 'qty') expect(item.quantityNeeded, item.name).toBeGreaterThanOrEqual(2);
      else expect(item.quantityNeeded, item.name).toBe(1);
    }
  });

  it('knows every item the trip templates start with', () => {
    for (const items of Object.values(TEMPLATES))
      for (const item of items) expect(findCatalogItem(item.name), item.name).toBeDefined();
  });

  it('never lets a name or a synonym belong to two items', () => {
    const owner = new Map<string, string>();
    for (const item of CATALOG)
      for (const key of [item.name, ...item.synonyms].map(normalizeName)) {
        const other = owner.get(key);
        expect(other === undefined || other === item.name, `${key}: ${other} / ${item.name}`).toBe(
          true,
        );
        owner.set(key, item.name);
      }
  });
});

describe('parseCatalog', () => {
  it('reads lines of items under a category, with synonyms, counts and icons', () => {
    const [grill, tongs, coal, coolers] = parseCatalog(
      '@cooking\nflame: מנגל=גריל, מלקחיים, פחמים:flame-kindling, צידניות*2',
    );
    expect(grill).toMatchObject({
      name: 'מנגל',
      icon: 'flame',
      synonyms: ['גריל'],
      kind: 'single',
    });
    expect(tongs).toMatchObject({ name: 'מלקחיים', icon: 'flame', category: 'בישול ועל האש' });
    expect(coal?.icon).toBe('flame-kindling');
    expect(coolers).toMatchObject({ kind: 'qty', quantityNeeded: 2 });
  });

  it('refuses an icon outside the set, or items outside a category', () => {
    expect(() => parseCatalog('@cooking\nrocket: מנגל')).toThrow('Unknown catalog icon');
    expect(() => parseCatalog('@cooking\nflame: מנגל:rocket')).toThrow('Unknown catalog icon');
    expect(() => parseCatalog('flame: מנגל')).toThrow('outside a category');
  });
});

describe('normalizeName', () => {
  it('ignores niqqud, quotes, dashes, final letters and case', () => {
    expect(normalizeName('  חד־פעמי ')).toBe(normalizeName('חד פעמי'));
    expect(normalizeName('סכו״ם')).toBe(normalizeName('סכום'));
    expect(normalizeName('שָׁלוֹם')).toBe(normalizeName('שלום'));
    expect(normalizeName('Cola')).toBe('cola');
  });
});

describe('searchCatalog', () => {
  it('finds by the start of the name, best first', () => {
    const [first, ...rest] = searchCatalog('מנג', { list: 'bring' });
    expect(first?.name).toBe('מנגל');
    expect(rest.length).toBeLessThanOrEqual(7);
  });

  it('finds by a synonym', () => {
    expect(searchCatalog('גריל')[0]?.name).toBe('מנגל');
  });

  it('never offers another item for what was typed', () => {
    // A related item is not a synonym: mango is not pineapple.
    const names = searchCatalog('מנגו', { limit: 50 }).map((i) => i.name);
    expect(names).toContain('מנגו');
    expect(names).not.toContain('אננס');
    expect(names.every((n) => n.includes('מנגו'))).toBe(true);
  });

  it('finds a singular for a plural', () => {
    expect(searchCatalog('עגבניה')[0]?.name).toBe('עגבניות');
  });

  it('finds by a later word', () => {
    expect(searchCatalog('שינה', { limit: 50 }).map((i) => i.name)).toContain('שק שינה');
  });

  it('puts the list being added to first and drops what the list has', () => {
    expect(searchCatalog('מים', { list: 'buy' })[0]?.list).toBe('buy');
    const taken = new Set(['מים']);
    expect(searchCatalog('מים', { exclude: taken }).map((i) => i.name)).not.toContain('מים');
  });

  it('is empty for nothing typed or nothing known', () => {
    expect(searchCatalog('  ')).toEqual([]);
    expect(searchCatalog('זזזזזזז')).toEqual([]);
  });
});

describe('same item', () => {
  it('knows other names and spellings of an item', () => {
    expect(findCatalogItem('גריל')?.name).toBe('מנגל');
    expect(sameItem('אוהל', 'אוהלים')).toBe(true);
    expect(sameItem('חד פעמי', 'חד־פעמי')).toBe(true);
    expect(itemKey('מנגל')).toBe(itemKey('גריל'));
    expect(sameItem('מנגל', 'פחמים')).toBe(false);
  });

  it('draws a known item with its own line icon, and nothing for an unknown one', () => {
    expect(catalogIcon('מנגל')).toBe('flame');
    expect(catalogIcon('אוהלים')).toBe('tent');
    expect(catalogIcon('בננות')).toBe('banana');
    expect(catalogIcon('זזזזז')).toBeUndefined();
  });
});

describe('heldCatalogNames', () => {
  it("adds the catalog's name for what a list has under another one", () => {
    const held = heldCatalogNames(['גריל', ' משהו אחר ']);
    expect(held.has('מנגל')).toBe(true);
    expect(held.has('משהו אחר')).toBe(true);
    expect(searchCatalog('מנג', { exclude: held }).map((i) => i.name)).not.toContain('מנגל');
  });
});
