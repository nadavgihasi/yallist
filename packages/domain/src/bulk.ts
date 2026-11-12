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
  /** An amount with a unit, `2 ק״ג`: how much to get, not how many. */
  amount?: string;
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

// A unit after a number makes it an amount: "2 ק״ג עגבניות", "מים 6 ליטר", "1.5 ליטר חלב".
const UNIT = String.raw`(?:ק["״”]?ג|קילו(?:גרם)?|גרם|גר['׳’]?|ג['׳’]|ליטר(?:ים)?|ל['׳’]|מ["״”]?ל|מטר(?:ים)?|ס["״”]מ|kg|gr?|ml|l)`;
const AMOUNT = String.raw`(\d{1,4}(?:\.\d{1,2})?)\s*(${UNIT})`;
const LEADING_AMOUNT = new RegExp(String.raw`^${AMOUNT}\s+(\S.*)$`, 'i');
const TRAILING_AMOUNT = new RegExp(String.raw`^(.*\S)\s+${AMOUNT}$`, 'i');
// Direction marks and zero-width characters that WhatsApp and web pages paste along (not the
// zero-width joiner, which holds emoji together).
const INVISIBLE = /[\u200b\u200c\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
// An emoji in front as a list marker: "✅ מחצלת", "▫️ פחמים".
const EMOJI_MARKER =
  /^\p{Extended_Pictographic}[\p{Extended_Pictographic}\p{Emoji_Modifier}\u200d\ufe0f]*\s+/u;
// WhatsApp's bold, italic and strikethrough around the whole line: "*מחצלת*".
const FORMATTED = /^([*_~])(.+)\1$/;

const clampQuantity = (n: number) => Math.min(Math.max(n, 1), ITEM_QUANTITY_MAX);

/** One line or comma-separated part; undefined when nothing is left of it. */
export function parseBulkLine(text: string): BulkLine | undefined {
  const line = text
    .replace(INVISIBLE, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(MARKER, '')
    .replace(EMOJI_MARKER, '')
    .replace(FORMATTED, '$2')
    .trim();
  // Nothing left, or a heading over the list: "לקנות:".
  if (!line || line.endsWith(':')) return undefined;
  const leadingAmount = LEADING_AMOUNT.exec(line);
  if (leadingAmount) {
    return { name: leadingAmount[3]!.trim(), amount: `${leadingAmount[1]} ${leadingAmount[2]}` };
  }
  const trailingAmount = TRAILING_AMOUNT.exec(line);
  if (trailingAmount) {
    return { name: trailingAmount[1]!.trim(), amount: `${trailingAmount[2]} ${trailingAmount[3]}` };
  }
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
  const { quantity, amount } = line;
  // An amount is how much of one item: its free text, as the buy list shows `4 ק״ג`.
  if (amount !== undefined) {
    return {
      list: known?.list ?? list,
      name: known?.name ?? line.name,
      kind: 'single',
      quantityNeeded: 1,
      category: known?.category ?? null,
      displayQty: amount,
    };
  }
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
