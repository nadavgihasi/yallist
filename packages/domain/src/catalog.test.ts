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
  parseEnglishNames,
  sameItem,
  searchCatalog,
} from './catalog';
import { CATALOG_ENGLISH } from './catalog-data';
import { TEMPLATES } from './templates';

/** Words whose next word names the product: a sewing kit is not a first-aid kit. */
const TWO_WORDS = new Set(
  [
    'ערכת',
    'ערכה',
    'תיק',
    'שקית',
    'שקיות',
    'קופסת',
    'קופסאות',
    'כלי',
    'מתקן',
    'מעמד',
    'נוזל',
    'חומר',
    'אבקת',
    'מיכל',
    'מכל',
    'סט',
    'כיסוי',
    'מארז',
    'צנצנת',
    'מכונת',
    'מכשיר',
    'מד',
    'ציוד',
    'כרטיס',
    'כרטיסי',
    'מברשת',
    'מחזיק',
    'רשת',
    'משאבת',
    'משאבה',
    'תבנית',
    'מסיר',
    'ספריי',
    'ג׳ל',
    'משחת',
    'טיפות',
    'כדורי',
    'קרם',
    'שמן',
    'סבון',
    'משחה',
    'נייר',
    'גבינת',
  ].map(normalizeName),
);
/** Different things that only start like another kind's word: potatoes are not apples. */
const OWN = new Set(
  [
    'תפוחי אדמה',
    'פלפל שחור',
    'גרעיני חמניות',
    'חמאת בוטנים',
    'סירופ מייפל',
    'סירופ שיעול',
    'מקלות הליכה',
    'פותחן בקבוקים',
    'מפתח ברגים',
    'מפתח אלן',
    'כבל טעינה',
    'מסכת פנים',
    'חבל כביסה',
    'קוביות קרח',
    'כרית חימום',
    'מזרן ציפה',
    'שואב אבק',
    'תנור חימום',
    'גלגל רזרבי',
    'מנעול למזוודה',
    'מזון תינוקות',
    'חטיפי כלבים',
    'בקבוק האכלה',
    'מגבת תינוק',
  ].map(normalizeName),
);
const plainNames = new Set(
  CATALOG.map((i) => normalizeName(i.name)).filter((n) => !n.includes(' ')),
);
/** Another form of a word that is itself an item: חולצת, חולצות → חולצה; מזלג → מזלגות. */
function base(w: string): string {
  const forms = [w];
  const cut = (n: number) => (w.length - n >= 3 ? w.slice(0, -n) : undefined);
  const s1 = cut(1);
  const s2 = cut(2);
  if (w.endsWith('ת') && s1) forms.push(s1 + 'ה');
  if (w.endsWith('ות') && s2) forms.push(s2 + 'ה', s2 + 'ת', s2);
  if (w.endsWith('ימ') && s2) forms.push(s2, s2 + 'ה');
  if (w.endsWith('י') && s1) forms.push(s1 + 'ימ', s1 + 'ות', s1, s1 + 'ה');
  if (w.length >= 3) forms.push(w + 'ות', w + 'ימ');
  return forms.find((f) => plainNames.has(f)) ?? w;
}
/** The kind of thing an item is, by its first word (or two). */
function family(name: string): string {
  const normal = normalizeName(name);
  if (OWN.has(normal)) return normal;
  const [first, second] = normal.split(' ');
  return TWO_WORDS.has(first!) && second ? `${first} ${base(second)}` : base(first!);
}

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
    // A sanity floor against losing a data file, not a target.
    expect(CATALOG.length).toBeGreaterThan(2000);
  });

  it('has items in every category', () => {
    for (const c of CATALOG_CATEGORIES)
      expect(
        CATALOG.some((i) => i.category === c.name),
        c.name,
      ).toBe(true);
  });

  it('keeps few variants of an item: different things, not twenty kinds of towel', () => {
    for (const item of CATALOG) {
      const prefix = `${normalizeName(item.name)} `;
      // Within a category: across them, a different thing can start with the same word
      // (שמן זית, שמן שיזוף).
      const variants = CATALOG.filter(
        (other) => other.category === item.category && normalizeName(other.name).startsWith(prefix),
      ).map((other) => other.name);
      expect(variants.length, `${item.name}: ${variants.join(', ')}`).toBeLessThanOrEqual(2);
    }
  });

  it('has at most 3 of a kind across the catalog: חולצה, חולצת טריקו, חולצת פולו', () => {
    const must = new Set(Object.values(TEMPLATES).flatMap((items) => items.map((i) => i.name)));
    const families = new Map<string, string[]>();
    for (const item of CATALOG) {
      if (must.has(item.name)) continue;
      const key = family(item.name);
      families.set(key, [...(families.get(key) ?? []), item.name]);
    }
    for (const [key, names] of families)
      expect(names.length, `${key}: ${names.join(', ')}`).toBeLessThanOrEqual(3);
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

  it('finds an item through a typo', () => {
    expect(searchCatalog('צדנית', { list: 'bring' })[0]?.name).toBe('צידנית');
    expect(searchCatalog('מנגאל', { list: 'bring' })[0]?.name).toBe('מנגל');
    expect(searchCatalog('נמגל', { list: 'bring' })[0]?.name).toBe('מנגל');
    expect(searchCatalog('אהל', { list: 'bring' })[0]?.name).toBe('אוהל');
    expect(searchCatalog('שק שנה', { list: 'bring' })[0]?.name).toBe('שק שינה');
  });

  it('finds common items by their English name, and through an English typo', () => {
    expect(searchCatalog('tent', { list: 'bring' })[0]?.name).toBe('אוהל');
    expect(searchCatalog('Tent')[0]?.name).toBe('אוהל');
    expect(searchCatalog('sleeping bag')[0]?.name).toBe('שק שינה');
    expect(searchCatalog('cooler')[0]?.name).toBe('צידנית');
    expect(searchCatalog('tnet')[0]?.name).toBe('אוהל');
  });

  it('keeps what is spelled right first: a typo match never pushes it aside', () => {
    // מנגו is a letter from מנגל, but typed right it finds only mango.
    expect(searchCatalog('מנגו', { limit: 50 }).every((i) => i.name.includes('מנגו'))).toBe(true);
    expect(searchCatalog('מנגל', { list: 'bring' })[0]?.name).toBe('מנגל');
    expect(searchCatalog('צידנית', { list: 'bring' })[0]?.name).toBe('צידנית');
  });

  it('stays fast on the whole catalog', () => {
    const queries = ['צדנית', 'מנגאל', 'tnet', 'זזזזזזז', 'שק שנה', 'כסאות מתקפלים'];
    const start = performance.now();
    for (let i = 0; i < 10; i++) for (const q of queries) searchCatalog(q);
    const each = (performance.now() - start) / (10 * queries.length);
    // A keystroke's search, well under a frame even on a slow test machine.
    expect(each).toBeLessThan(30);
  });
});

describe('English names', () => {
  it('names catalog items only, and are never synonyms', () => {
    for (const name of parseEnglishNames(CATALOG_ENGLISH).keys())
      expect(
        CATALOG.some((i) => i.name === name),
        name,
      ).toBe(true);
    expect(findCatalogItem('tent')).toBeUndefined();
    expect(sameItem('tent', 'אוהל')).toBe(false);
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
