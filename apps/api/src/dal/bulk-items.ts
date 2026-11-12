import { bulkKey, type BulkItem } from '@yallist/domain';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import { items, tripCategories, type LISTS } from '../db/schema';
import type { Tx } from '../db/tx';
import { appendCategory } from './categories';
import { endOfList } from './items';

type List = (typeof LISTS)[number];

/**
 * Adds many items at once, each at the end of its list, in order. One the list already has (the
 * same name or synonym), or an earlier one of the batch is, is skipped. A category is the list's
 * own of that name, ignoring case, or a new one at the end of the list. The caller holds the
 * trip lock (lock order trip → member → category), so nothing else adds or deletes meanwhile.
 */
export async function addItems(tx: Tx, tripId: string, createdBy: string, batch: BulkItem[]) {
  const live = await tx
    .select({ list: items.list, name: items.name })
    .from(items)
    .where(and(eq(items.tripId, tripId), isNull(items.deletedAt)));
  const held = new Set(live.map((i) => bulkKey(i.list, i.name)));
  const skipped: BulkItem[] = [];
  const fresh = batch.filter((item) => {
    const key = bulkKey(item.list, item.name);
    if (held.has(key)) {
      skipped.push(item);
      return false;
    }
    held.add(key);
    return true;
  });
  if (fresh.length === 0) return { added: [], skipped };

  // The lists' categories by name, locked: none of them can be deleted under the new items.
  const categories = await tx
    .select({ id: tripCategories.id, list: tripCategories.list, name: tripCategories.name })
    .from(tripCategories)
    .where(eq(tripCategories.tripId, tripId))
    .for('update');
  const categoryKey = (list: List, name: string) => `${list}/${name.trim().toLowerCase()}`;
  const categoryIds = new Map(categories.map((c) => [categoryKey(c.list, c.name), c.id]));
  const categoryFor = async (list: List, name: string | null) => {
    if (!name?.trim()) return null;
    const key = categoryKey(list, name);
    let id = categoryIds.get(key);
    if (!id) {
      id = (await appendCategory(tx, tripId, list, name.trim())).id;
      categoryIds.set(key, id);
    }
    return id;
  };

  const next = {
    bring: await endOfList(tx, tripId, 'bring'),
    buy: await endOfList(tx, tripId, 'buy'),
  };
  const rows = [];
  for (const item of fresh) {
    rows.push({
      tripId,
      createdBy,
      list: item.list,
      name: item.name,
      kind: item.kind,
      quantityNeeded: item.quantityNeeded,
      unit: item.unit ?? null,
      displayQty: item.displayQty ?? null,
      categoryId: await categoryFor(item.list, item.category),
      position: next[item.list]++,
      legacyCategory: '',
    });
  }
  const added = await tx.insert(items).values(rows).returning();
  // In list order: `returning` doesn't promise the insert's.
  added.sort((a, b) => a.list.localeCompare(b.list) || a.position - b.position);
  return { added, skipped };
}

/**
 * Another trip's items as new items for a trip: what they are (name, list, count, unit, category
 * by name), never what happened to them there (claims, purchases, notes). Only live items of that
 * trip, in list order; ids that aren't one are left out.
 */
export async function copyableItems(
  tx: Tx,
  fromTripId: string,
  itemIds: string[],
): Promise<BulkItem[]> {
  const rows = await tx
    .select({ item: items, category: tripCategories.name })
    .from(items)
    .leftJoin(tripCategories, eq(tripCategories.id, items.categoryId))
    .where(and(eq(items.tripId, fromTripId), inArray(items.id, itemIds), isNull(items.deletedAt)))
    .orderBy(asc(items.list), asc(items.position));
  return rows.map(({ item, category }) => ({
    list: item.list,
    name: item.name,
    kind: item.kind,
    quantityNeeded: item.quantityNeeded,
    unit: item.unit,
    displayQty: item.displayQty,
    category,
  }));
}
