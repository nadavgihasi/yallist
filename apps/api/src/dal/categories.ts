import { and, asc, eq, inArray, max, ne, sql } from 'drizzle-orm';

import { fail } from '../access';
import { items, tripCategories } from '../db/schema';
import type { Executor, Tx } from '../db/tx';

type List = (typeof tripCategories.$inferSelect)['list'];

/** The trips' categories, in list order. */
export const listCategories = (tx: Executor, tripIds: string[]) =>
  tx
    .select()
    .from(tripCategories)
    .where(inArray(tripCategories.tripId, tripIds))
    .orderBy(asc(tripCategories.list), asc(tripCategories.position));

/** A category of the trip, locked: items can't be put into one that's being deleted. */
export async function lockCategory(tx: Tx, tripId: string, categoryId: string) {
  const [category] = await tx
    .select()
    .from(tripCategories)
    .where(and(eq(tripCategories.id, categoryId), eq(tripCategories.tripId, tripId)))
    .for('update');
  if (!category) throw fail(404, 'Category not found');
  return category;
}

/** 409 if the list has another category of that name, ignoring case. */
export async function assertNameFree(
  tx: Executor,
  tripId: string,
  list: List,
  name: string,
  exceptId?: string,
) {
  const [taken] = await tx
    .select({ id: tripCategories.id })
    .from(tripCategories)
    .where(
      and(
        eq(tripCategories.tripId, tripId),
        eq(tripCategories.list, list),
        sql`lower(${tripCategories.name}) = lower(${name})`,
        exceptId ? ne(tripCategories.id, exceptId) : undefined,
      ),
    );
  if (taken) throw fail(409, 'A category with this name exists');
}

/** Adds the category at the end of its list. */
export async function appendCategory(tx: Executor, tripId: string, list: List, name: string) {
  const [last] = await tx
    .select({ position: max(tripCategories.position) })
    .from(tripCategories)
    .where(and(eq(tripCategories.tripId, tripId), eq(tripCategories.list, list)));
  const [created] = await tx
    .insert(tripCategories)
    .values({ tripId, list, name, position: (last?.position ?? -1) + 1 })
    .returning();
  return created!;
}

/** Copies template categories into a new trip, in order; returns their ids by list and name. */
export async function insertCategories(
  tx: Executor,
  tripId: string,
  categories: { list: List; name: string }[],
) {
  if (categories.length === 0) return new Map<string, string>();
  const rows = await tx
    .insert(tripCategories)
    .values(
      categories.map((c) => ({
        ...c,
        tripId,
        position: categories.filter((o) => o.list === c.list).indexOf(c),
      })),
    )
    .returning();
  return new Map(rows.map((r) => [`${r.list}/${r.name}`, r.id]));
}

export async function renameCategory(tx: Executor, categoryId: string, name: string) {
  const [category] = await tx
    .update(tripCategories)
    .set({ name })
    .where(eq(tripCategories.id, categoryId))
    .returning();
  return category!;
}

/** Positions the given categories in array order. */
export const setCategoryOrder = (tx: Executor, categoryIds: string[]) =>
  Promise.all(
    categoryIds.map((id, position) =>
      tx.update(tripCategories).set({ position }).where(eq(tripCategories.id, id)),
    ),
  );

/** Deletes the category; its items, live and deleted, become uncategorized. */
export async function deleteCategory(tx: Executor, tripId: string, categoryId: string) {
  await tx
    .update(items)
    .set({ categoryId: null })
    .where(and(eq(items.tripId, tripId), eq(items.categoryId, categoryId)));
  await tx.delete(tripCategories).where(eq(tripCategories.id, categoryId));
}
