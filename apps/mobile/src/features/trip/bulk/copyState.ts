import {
  planBulkAdd,
  type BulkEntry,
  type BulkItem,
  type Item,
  type ListKind,
} from '@yallist/domain';

import type { TripData } from '@/state/types';

/** One of my other trips to copy from, as the home screen lists it. */
export interface SourceTrip {
  trip: { id: string; name: string; startsOn: string; endsOn: string };
  itemCount: number;
}

/** My other trips that have items to copy, the latest first. */
export function copySources<T extends SourceTrip>(trips: readonly T[], tripId: string): T[] {
  return trips
    .filter((t) => t.trip.id !== tripId && t.itemCount > 0)
    .sort((a, b) => b.trip.startsOn.localeCompare(a.trip.startsOn));
}

/** A source trip's item as it would be copied, and what will happen to it. */
export type CopyEntry = BulkEntry & { id: string };

/**
 * The source trip's items as they'd be copied (what they are: name, list, count, unit, category;
 * never claims, purchases or notes), each against what this trip's lists already have.
 */
export function copyEntries(
  source: Pick<TripData, 'items' | 'categories'>,
  existing: readonly Pick<Item, 'list' | 'name'>[],
): CopyEntry[] {
  const items = [...source.items].sort(
    (a, b) => a.list.localeCompare(b.list) || a.position - b.position,
  );
  const asBulk = (i: Item): BulkItem => ({
    list: i.list,
    name: i.name,
    kind: i.kind,
    quantityNeeded: i.quantityNeeded,
    unit: i.unit ?? null,
    displayQty: i.displayQty ?? null,
    category: source.categories.find((c) => c.id === i.categoryId)?.name ?? null,
  });
  return planBulkAdd(items.map(asBulk), existing).map((entry, index) => ({
    ...entry,
    id: items[index]!.id,
  }));
}

/** The entries by list, bring first; lists with none are left out. */
export function copyGroups(
  entries: readonly CopyEntry[],
): { list: ListKind; entries: CopyEntry[] }[] {
  return (['bring', 'buy'] as const)
    .map((list) => ({ list, entries: entries.filter((e) => e.item.list === list) }))
    .filter((g) => g.entries.length > 0);
}

/** The ids to copy: what can be added, less what was unticked. */
export const copyPicked = (entries: readonly CopyEntry[], unpicked: ReadonlySet<string>) =>
  entries.filter((e) => e.status === 'add' && !unpicked.has(e.id)).map((e) => e.id);
