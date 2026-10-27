import { and, asc, eq, isNull, max, or } from 'drizzle-orm';

import { fail } from '../access';
import { claims, items, templateItems, type TEMPLATE_IDS } from '../db/schema';
import type { Executor, Tx } from '../db/tx';
import { insertCategories } from './categories';

type NewItem = Omit<
  typeof items.$inferInsert,
  'id' | 'tripId' | 'position' | 'createdBy' | 'legacyCategory'
>;
type ItemChanges = Partial<NewItem & { position: number }>;

/**
 * Items everyone in the trip sees, plus `owner`'s private items when given. Everyone else's
 * private items don't exist, as far as any query built on this can tell.
 */
export const visibleTo = (owner?: string | null) =>
  owner
    ? or(isNull(items.privateOwnerId), eq(items.privateOwnerId, owner))
    : isNull(items.privateOwnerId);

/**
 * A live (not deleted) shared item of the trip, or with `owner`, also one of their private items.
 * Writes pass `lock`: claims and edits run one at a time.
 */
export async function findItem(
  tx: Executor,
  tripId: string,
  itemId: string,
  { lock = false, owner }: { lock?: boolean; owner?: string } = {},
) {
  const query = tx
    .select()
    .from(items)
    .where(
      and(
        eq(items.id, itemId),
        eq(items.tripId, tripId),
        isNull(items.deletedAt),
        visibleTo(owner),
      ),
    );
  const [item] = await (lock ? query.for('update') : query);
  return item;
}

export async function lockItem(tx: Tx, tripId: string, itemId: string, owner?: string) {
  const item = await findItem(tx, tripId, itemId, { lock: true, owner });
  if (!item) throw fail(404, 'Item not found');
  return item;
}

/** The position after the last item of the list. */
export async function endOfList(tx: Executor, tripId: string, list: NewItem['list']) {
  const [last] = await tx
    .select({ position: max(items.position) })
    .from(items)
    .where(and(eq(items.tripId, tripId), eq(items.list, list)));
  return (last?.position ?? -1) + 1;
}

/** Adds the item at the end of its list. */
export async function appendItem(tx: Executor, tripId: string, createdBy: string, item: NewItem) {
  const position = await endOfList(tx, tripId, item.list);
  const [created] = await tx
    .insert(items)
    .values({ ...item, tripId, position, createdBy, legacyCategory: '' })
    .returning();
  return created!;
}

/** Copies the template's categories and items into the trip. */
export async function seedItems(
  tx: Executor,
  tripId: string,
  createdBy: string,
  template: (typeof TEMPLATE_IDS)[number],
) {
  const seed = await tx
    .select()
    .from(templateItems)
    .where(eq(templateItems.template, template))
    .orderBy(asc(templateItems.list), asc(templateItems.position));
  if (seed.length === 0) return;
  // In order of first appearance, one per list and name.
  const categories = new Map(
    seed.map((i) => [`${i.list}/${i.category}`, { list: i.list, name: i.category }]),
  );
  const categoryIds = await insertCategories(tx, tripId, [...categories.values()]);
  await tx.insert(items).values(
    seed.map(({ template: _, category, ...item }) => ({
      ...item,
      tripId,
      createdBy,
      categoryId: categoryIds.get(`${item.list}/${category}`),
      legacyCategory: '',
    })),
  );
}

export async function updateItem(tx: Executor, itemId: string, changes: ItemChanges) {
  const [item] = await tx.update(items).set(changes).where(eq(items.id, itemId)).returning();
  return item!;
}

/** Adds a private item to the owner's bag, claimed by them. */
export async function addPrivateItem(tx: Executor, tripId: string, owner: string, name: string) {
  const item = await appendItem(tx, tripId, owner, {
    list: 'bring',
    kind: 'single',
    name,
    privateOwnerId: owner,
  });
  await tx.insert(claims).values({ itemId: item.id, userId: owner, quantity: 1 });
  return item;
}

/** Soft delete: the item and its claims disappear from the trip, the history stays. */
export const deleteItem = (tx: Executor, itemId: string) =>
  tx.update(items).set({ deletedAt: new Date() }).where(eq(items.id, itemId));
