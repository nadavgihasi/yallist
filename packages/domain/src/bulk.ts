import { findCatalogItem, itemKey } from './catalog';
import type { ItemKind, ListKind } from './types';

/**
 * Adding many items at once: typed or pasted lines, ticked suggestions, or a previous trip's
 * items. All of them go to the API in one request, one transaction.
 */

/** At most this many items per request: well under DSQL's 3,000 rows per transaction. */
export const BULK_MAX_ITEMS = 100;
/** An item name's length limit, as the API checks it. */
export const ITEM_NAME_MAX = 80;
/** The largest count an item can need. */
export const ITEM_QUANTITY_MAX = 999;

/** One typed line: a name, and the count written next to it, if any. */
export interface BulkLine {
  name: string;
  quantity?: number;
}

/** What one bulk-added item becomes: its list, how it's counted, and its category by name. */
export interface BulkItem {
  list: ListKind;
  name: string;
  kind: ItemKind;
  quantityNeeded: number;
  /** The trip category it goes into, made if the list has none of that name; null: none. */
  category: string | null;
  unit?: string | null;
  displayQty?: string | null;
}

// A list marker in front: "- ", "• ", "1. ", "2) ".
const MARKER = /^(?:[-–—•*·▪●◦]|\d{1,3}[.)])\s+/;
// "2 כיסאות", "2x כיסאות", "×2 כיסאות".
const LEADING = /^(?:[x×X*]\s*)?(\d{1,4})(?:\s*[x×X*]\s*|\s+)(\S.*)$/;
// "כיסאות x2", "כיסאות ×2", "כיסאות×2", "כיסאות 2x".
const TRAILING = /^(.*\S)(?:\s+[x×X*]|×)\s*(\d{1,4})$|^(.*\S)\s+(\d{1,4})\s*[x×X]$/;

const clampQuantity = (n: number) => Math.min(Math.max(n, 1), ITEM_QUANTITY_MAX);

/** One line or comma-separated part; undefined when nothing is left of it. */
export function parseBulkLine(text: string): BulkLine | undefined {
  const line = text.replace(/\s+/g, ' ').trim().replace(MARKER, '').trim();
  if (!line) return undefined;
  const trailing = TRAILING.exec(line);
  if (trailing) {
    const name = (trailing[1] ?? trailing[3])!.trim();
    return { name, quantity: clampQuantity(Number(trailing[2] ?? trailing[4])) };
  }
  const leading = LEADING.exec(line);
  if (leading) return { name: leading[2]!.trim(), quantity: clampQuantity(Number(leading[1])) };
  return { name: line };
}

/** The items in a typed or pasted text: one per line, also split on commas. Blanks are dropped. */
export function parseBulkText(text: string): BulkLine[] {
  return text.split(/[\n\r,،]+/).flatMap((part) => {
    const line = parseBulkLine(part);
    return line ? [line] : [];
  });
}

/**
 * A line as an item, filled in from the catalog when it knows the name or one of its synonyms,
 * as picking a suggestion does: the catalog's spelling, list, count and category. A count
 * written on the line wins over the catalog's.
 */
export function bulkItemFor(line: BulkLine, list: ListKind): BulkItem {
  const known = findCatalogItem(line.name);
  const { quantity } = line;
  const kind: ItemKind =
    quantity === undefined ? (known?.kind ?? 'single') : quantity >= 2 ? 'qty' : 'single';
  const quantityNeeded =
    quantity !== undefined
      ? kind === 'qty'
        ? quantity
        : 1
      : kind === 'qty'
        ? known!.quantityNeeded
        : 1;
  return {
    list: known?.list ?? list,
    name: known?.name ?? line.name,
    kind,
    quantityNeeded,
    category: known?.category ?? null,
  };
}

/** What identifies an item within a list: the same name or synonym is the same item. */
export const bulkKey = (list: ListKind, name: string) => `${list}/${itemKey(name)}`;

/**
 * - `add`: will be added
 * - `exists`: the list already has it (same name or synonym)
 * - `repeat`: an earlier entry of this batch is the same item
 * - `tooLong`: the name is longer than an item name can be
 */
export type BulkStatus = 'add' | 'exists' | 'repeat' | 'tooLong';

export interface BulkEntry {
  item: BulkItem;
  status: BulkStatus;
}

/** Each item with what will happen to it, against what the trip's lists already hold. */
export function planBulkAdd(
  items: readonly BulkItem[],
  existing: readonly { list: ListKind; name: string }[],
): BulkEntry[] {
  const held = new Set(existing.map((i) => bulkKey(i.list, i.name)));
  const seen = new Set<string>();
  return items.map((item) => {
    if (item.name.length > ITEM_NAME_MAX) return { item, status: 'tooLong' };
    const key = bulkKey(item.list, item.name);
    if (held.has(key)) return { item, status: 'exists' };
    if (seen.has(key)) return { item, status: 'repeat' };
    seen.add(key);
    return { item, status: 'add' };
  });
}

/** The entries that will be added. */
export const bulkToAdd = (entries: readonly BulkEntry[]): BulkItem[] =>
  entries.filter((e) => e.status === 'add').map((e) => e.item);
