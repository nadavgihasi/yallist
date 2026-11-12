import {
  bulkItemFor,
  bulkToAdd,
  parseBulkText,
  planBulkAdd,
  sameItem,
  BULK_MAX_ITEMS,
  type BulkEntry,
  type Item,
  type ListKind,
} from '@yallist/domain';

/**
 * What the bulk sheet will add: the typed lines first, then the ticked suggestions, each filled
 * in from the catalog, checked against what the trip's lists already have.
 */
export function bulkEntries(
  text: string,
  picked: readonly string[],
  list: ListKind,
  existing: readonly Pick<Item, 'list' | 'name'>[],
): BulkEntry[] {
  const lines = [...parseBulkText(text), ...picked.map((name) => ({ name }))];
  return planBulkAdd(
    lines.map((line) => bulkItemFor(line, list)),
    existing,
  );
}

export interface BulkSummary {
  /** Will be added. */
  add: number;
  /** Already on the list: skipped. */
  exists: number;
  /** More than one request takes. */
  tooMany: boolean;
}

export function bulkSummary(entries: readonly BulkEntry[]): BulkSummary {
  const add = bulkToAdd(entries).length;
  return {
    add,
    exists: entries.filter((e) => e.status === 'exists').length,
    tooMany: add > BULK_MAX_ITEMS,
  };
}

/** Ticks a suggestion, or unticks it (by the same item, so a synonym counts as ticked). */
export function togglePicked(picked: readonly string[], name: string): string[] {
  return picked.some((p) => sameItem(p, name))
    ? picked.filter((p) => !sameItem(p, name))
    : [...picked, name];
}

/** Whether the suggestion is ticked. */
export const isPicked = (picked: readonly string[], name: string) =>
  picked.some((p) => sameItem(p, name));
