import { and, eq, isNull, max } from 'drizzle-orm';

import { fail } from '../access';
import { items, templateItems, type TEMPLATE_IDS } from '../db/schema';
import type { Executor, Tx } from '../db/tx';

type NewItem = Omit<typeof items.$inferInsert, 'id' | 'tripId' | 'position' | 'createdBy'>;
type ItemChanges = Partial<Omit<NewItem, 'list' | 'kind'>>;

/** A live (not deleted) item of the trip. Writes pass `lock`: claims and edits run one at a time. */
export async function findItem(
  tx: Executor,
  tripId: string,
  itemId: string,
  { lock = false } = {},
) {
  const query = tx
    .select()
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.tripId, tripId), isNull(items.deletedAt)));
  const [item] = await (lock ? query.for('update') : query);
  return item;
}

export async function lockItem(tx: Tx, tripId: string, itemId: string) {
  const item = await findItem(tx, tripId, itemId, { lock: true });
  if (!item) throw fail(404, 'Item not found');
  return item;
}

/** Adds the item at the end of its list. */
export async function appendItem(tx: Executor, tripId: string, createdBy: string, item: NewItem) {
  const [last] = await tx
    .select({ position: max(items.position) })
    .from(items)
    .where(and(eq(items.tripId, tripId), eq(items.list, item.list)));
  const [created] = await tx
    .insert(items)
    .values({ ...item, tripId, position: (last?.position ?? -1) + 1, createdBy })
    .returning();
  return created!;
}

/** Copies the template's items into the trip. */
export async function seedItems(
  tx: Executor,
  tripId: string,
  createdBy: string,
  template: (typeof TEMPLATE_IDS)[number],
) {
  const seed = await tx.select().from(templateItems).where(eq(templateItems.template, template));
  if (seed.length === 0) return;
  await tx
    .insert(items)
    .values(seed.map(({ template: _, ...item }) => ({ ...item, tripId, createdBy })));
}

export async function updateItem(tx: Executor, itemId: string, changes: ItemChanges) {
  const [item] = await tx.update(items).set(changes).where(eq(items.id, itemId)).returning();
  return item!;
}

/** Soft delete: the item and its claims disappear from the trip, the history stays. */
export const deleteItem = (tx: Executor, itemId: string) =>
  tx.update(items).set({ deletedAt: new Date() }).where(eq(items.id, itemId));
