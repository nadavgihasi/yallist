import { CATALOG_SOURCES } from './catalog-data';
import type { ItemKind, ListKind } from './types';

/** A group of catalog items. Its list is where its items belong: what to bring or what to buy. */
export interface CatalogCategory {
  /** Stable id, never shown; the data files group their items under it. */
  id: string;
  /** Shown, and the name of the trip category the item lands in. */
  name: string;
  icon: string;
  list: ListKind;
}

export interface CatalogItem {
  /** The canonical name: what a trip item and my bag are matched by, so always the same spelling. */
  name: string;
  /** An emoji: a picture per item, drawn by the system on every platform. */
  icon: string;
  category: string;
  list: ListKind;
  /** How it's usually counted; `single` unless the entry says otherwise. */
  kind: ItemKind;
  /** The count for `qty`. */
  quantityNeeded: number;
  /**
   * Other names for this very item (`גריל` for `מנגל`). Never a related item: `מנגו` is not an
   * alias of `אננס`. A name or synonym belongs to one item only.
   */
  synonyms: string[];
}

const cat = (id: string, name: string, icon: string, list: ListKind): CatalogCategory => ({
  id,
  name,
  icon,
  list,
});

export const CATALOG_CATEGORIES: CatalogCategory[] = [
  // What to bring.
  cat('cooking', 'בישול ועל האש', '🔥', 'bring'),
  cat('sleeping', 'לינה', '⛺', 'bring'),
  cat('seating', 'ישיבה וצל', '🪑', 'bring'),
  cat('tableware', 'כלים וסכו״ם', '🍽️', 'bring'),
  cat('kitchen', 'ציוד מטבח', '🍳', 'bring'),
  cat('clothes', 'ביגוד והנעלה', '👕', 'bring'),
  cat('hygiene', 'היגיינה וטיפוח', '🧴', 'bring'),
  cat('health', 'עזרה ראשונה ובריאות', '🩹', 'bring'),
  cat('light', 'תאורה וניווט', '🔦', 'bring'),
  cat('tools', 'כלי עבודה', '🔧', 'bring'),
  cat('tech', 'חשמל וטכנולוגיה', '🔌', 'bring'),
  cat('water', 'ים ובריכה', '🏖️', 'bring'),
  cat('sports', 'ספורט וטיולים', '🥾', 'bring'),
  cat('winter', 'שלג וחורף', '⛷️', 'bring'),
  cat('wheels', 'רכב ואופניים', '🚗', 'bring'),
  cat('fishing', 'דיג', '🎣', 'bring'),
  cat('fun', 'משחקים ובידור', '🎲', 'bring'),
  cat('kids', 'ילדים ותינוקות', '🍼', 'bring'),
  cat('pets', 'חיות מחמד', '🐕', 'bring'),
  cat('party', 'מסיבה ואירוח', '🎉', 'bring'),
  cat('docs', 'מסמכים וכסף', '🪪', 'bring'),
  cat('general', 'כללי', '🎒', 'bring'),
  // What to buy.
  cat('meat', 'בשר', '🥩', 'buy'),
  cat('fish', 'דגים ופירות ים', '🐟', 'buy'),
  cat('bread', 'לחם וסלטים', '🥖', 'buy'),
  cat('bakery', 'מאפים ועוגות', '🥐', 'buy'),
  cat('veg', 'ירקות', '🥬', 'buy'),
  cat('fruit', 'פירות', '🍉', 'buy'),
  cat('nuts', 'אגוזים ופירות יבשים', '🥜', 'buy'),
  cat('dairy', 'חלב וביצים', '🥚', 'buy'),
  cat('cheese', 'גבינות', '🧀', 'buy'),
  cat('breakfast', 'ארוחת בוקר', '🥣', 'buy'),
  cat('pantry', 'מזווה', '🍚', 'buy'),
  cat('spices', 'תבלינים', '🌶️', 'buy'),
  cat('sauces', 'רטבים ושמנים', '🫒', 'buy'),
  cat('canned', 'שימורים ומוכנים', '🥫', 'buy'),
  cat('frozen', 'קפואים וגלידות', '🍦', 'buy'),
  cat('snacks', 'חטיפים וממתקים', '🍫', 'buy'),
  cat('drinks', 'שתייה', '🥤', 'buy'),
  cat('coffee', 'קפה ותה', '☕', 'buy'),
  cat('alcohol', 'אלכוהול', '🍺', 'buy'),
  cat('cleaning', 'ניקיון וחד־פעמי', '🧻', 'buy'),
  cat('care', 'מוצרי טיפוח', '🧼', 'buy'),
  cat('pharmacy', 'בית מרקחת', '💊', 'buy'),
  cat('baby', 'מוצרי תינוקות', '👶', 'buy'),
];

const categories = new Map(CATALOG_CATEGORIES.map((c) => [c.id, c]));

/**
 * The data files list items in a line each, under `@category` headings:
 *
 *     @cooking
 *     🔥: מנגל=גריל, פחמים:⚫, צידניות*2, מלקחיים
 *
 * `icon:` before the items is theirs; `name:icon` overrides it for one; `=a/b` are synonyms;
 * `*each` is a per-person item and `*4` a quantity.
 */
const ITEM = /^([^:=*]+)(?::([^=*]+))?(?:=([^*]+))?(?:\*(each|\d+))?$/;

export function parseCatalog(source: string): CatalogItem[] {
  const items: CatalogItem[] = [];
  let category: CatalogCategory | undefined;
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('@')) {
      category = categories.get(line.slice(1).trim());
      if (!category) throw new Error(`Unknown catalog category: ${line}`);
      continue;
    }
    const colon = line.indexOf(':');
    if (!category || colon < 0) throw new Error(`Catalog line outside a category: ${line}`);
    const icon = line.slice(0, colon).trim();
    for (const token of line.slice(colon + 1).split(',')) {
      const text = token.trim();
      if (!text) continue;
      const match = ITEM.exec(text);
      if (!match) throw new Error(`Bad catalog item: ${text}`);
      const [, name, own, synonyms, count] = match;
      items.push({
        name: name!.trim(),
        icon: own?.trim() || icon,
        category: category.name,
        list: category.list,
        kind: count === 'each' ? 'each' : count ? 'qty' : 'single',
        quantityNeeded: count && count !== 'each' ? Number(count) : 1,
        synonyms: synonyms ? synonyms.split('/').map((s) => s.trim()) : [],
      });
    }
  }
  return items;
}

/**
 * Every built-in item, in the order of the data files. A name or synonym that an earlier item
 * already has is dropped, so one never belongs to two items.
 */
export const CATALOG: CatalogItem[] = (() => {
  const taken = new Set<string>();
  return CATALOG_SOURCES.flatMap(parseCatalog).flatMap((item) => {
    const keys = [item.name, ...item.synonyms].map(normalizeName);
    if (keys.some((k) => taken.has(k))) return [];
    keys.forEach((k) => taken.add(k));
    return [item];
  });
})();

/**
 * A text as the catalog compares it: no niqqud, quotes, dashes or case, final letters as regular
 * ones, single spaces. Typing `חד פעמי`, `חד־פעמי` or `חד-פעמי` finds the same item.
 */
export function normalizeName(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[֑-ׇֽֿׁׂׅׄ]/g, '')
    .replace(/["'`״׳’‘“”.]/g, '')
    .replace(/[-־_/]/g, ' ')
    .replace(/ך/g, 'כ')
    .replace(/ם/g, 'מ')
    .replace(/ן/g, 'נ')
    .replace(/ף/g, 'פ')
    .replace(/ץ/g, 'צ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** A word without its plural or feminine ending, so `עגבניה` finds `עגבניות`. For searching only. */
function stem(word: string): string {
  for (const end of ['ות', 'ים', 'ה', 'ת', 'י']) {
    if (word.length >= end.length + 3 && word.endsWith(end)) return word.slice(0, -end.length);
  }
  return word;
}

interface Indexed {
  item: CatalogItem;
  name: string;
  words: string[];
  stems: string[];
  synonyms: string[];
  synonymWords: string[];
  synonymStems: string[];
}

const INDEX: Indexed[] = CATALOG.map((item) => {
  const name = normalizeName(item.name);
  const synonyms = item.synonyms.map(normalizeName);
  const words = name.split(' ');
  const synonymWords = synonyms.flatMap((s) => s.split(' '));
  return {
    item,
    name,
    words,
    stems: words.map(stem),
    synonyms,
    synonymWords,
    synonymStems: synonymWords.map(stem),
  };
});

/** First entry wins when a name or synonym is shared (a test keeps that from happening). */
const BY_NAME = new Map<string, CatalogItem>();
for (const { item, name } of INDEX) if (!BY_NAME.has(name)) BY_NAME.set(name, item);
const BY_SYNONYM = new Map<string, CatalogItem>();
for (const { item, synonyms } of INDEX)
  for (const synonym of synonyms) if (!BY_SYNONYM.has(synonym)) BY_SYNONYM.set(synonym, item);

/** The item of that name, or that goes by it; undefined for what the catalog doesn't know. */
export function findCatalogItem(name: string): CatalogItem | undefined {
  const key = normalizeName(name);
  return key ? (BY_NAME.get(key) ?? BY_SYNONYM.get(key)) : undefined;
}

/** A picture for an item: the catalog's, by name; undefined when the catalog doesn't know it. */
export const catalogIcon = (name: string): string | undefined => findCatalogItem(name)?.icon;

/** Whether every typed word starts one of the words, or one of their stems. */
const startsWords = (tokens: string[], stems: string[], words: string[], wordStems: string[]) =>
  tokens.every((t, i) => {
    const s = stems[i]!;
    return words.some((w, j) => w.startsWith(t) || wordStems[j]!.startsWith(s));
  });

/** Lower is a better match; undefined for none. */
function score(
  entry: Indexed,
  query: string,
  tokens: string[],
  stems: string[],
): number | undefined {
  if (entry.name === query) return 0;
  if (entry.name.startsWith(query)) return 1;
  if (entry.synonyms.includes(query)) return 2;
  if (startsWords(tokens, stems, entry.words, entry.stems)) return 3;
  if (entry.synonyms.some((s) => s.startsWith(query))) return 4;
  if (startsWords(tokens, stems, entry.synonymWords, entry.synonymStems)) return 5;
  if (query.length >= 3 && entry.name.includes(query)) return 6;
  return undefined;
}

/**
 * Catalog items for what's being typed, best first. `list` is the list being added to: its items
 * come before the other list's at the same quality, and `exclude` drops names already there.
 */
export function searchCatalog(
  text: string,
  {
    list,
    exclude,
    limit = 8,
  }: { list?: ListKind; exclude?: ReadonlySet<string>; limit?: number } = {},
): CatalogItem[] {
  const query = normalizeName(text);
  if (!query) return [];
  const tokens = query.split(' ');
  const stems = tokens.map(stem);
  const hits: { item: CatalogItem; rank: number; order: number }[] = [];
  INDEX.forEach((entry, order) => {
    if (exclude?.has(entry.item.name)) return;
    const s = score(entry, query, tokens, stems);
    if (s === undefined) return;
    hits.push({
      item: entry.item,
      rank: s * 2 + (list && entry.item.list !== list ? 1 : 0),
      order,
    });
  });
  return hits
    .sort((a, b) => a.rank - b.rank || a.item.name.length - b.item.name.length || a.order - b.order)
    .slice(0, limit)
    .map((h) => h.item);
}

/** The items of one category, in catalog order. */
export const catalogCategoryItems = (name: string): CatalogItem[] =>
  CATALOG.filter((i) => i.category === name);

/**
 * What identifies an item across trips and my bag: the catalog's name when the catalog knows it
 * (so `גריל` and `מנגל` are one item), otherwise the name as typed, normalized. Spelling, quotes
 * and case never keep two same items apart.
 */
export const itemKey = (name: string): string => normalizeName(findCatalogItem(name)?.name ?? name);

/** Whether two names are the same item: how a trip item meets my bag. */
export const sameItem = (a: string, b: string): boolean => a === b || itemKey(a) === itemKey(b);

/**
 * The names an item is already under in a list: those as they are, and the catalog's own for
 * the ones it knows, so a search leaves out `מנגל` once the list has `גריל`.
 */
export function heldCatalogNames(names: Iterable<string>): Set<string> {
  const held = new Set<string>();
  for (const name of names) {
    held.add(name.trim());
    const known = findCatalogItem(name);
    if (known) held.add(known.name);
  }
  return held;
}
