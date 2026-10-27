import { claimCap, claimedQuantity } from '@yallist/domain';
import { Hono } from 'hono';
import { z } from 'zod';

import { fail, validate } from '../access';
import { requireUser, type Auth } from '../auth';
import { logActivity } from '../dal/activity';
import { lockCategory } from '../dal/categories';
import { lockClaims, setClaim, setPacked } from '../dal/claims';
import { findPurchase } from '../dal/expenses';
import { appendItem, deleteItem, endOfList, lockItem, updateItem } from '../dal/items';
import { requireMember } from '../dal/members';
import type { Db } from '../db/client';
import { KINDS, LISTS } from '../db/schema';
import { transact, type Tx } from '../db/tx';
import { toItem } from '../trip-data';

const text = (maxLength: number) => z.string().trim().min(1).max(maxLength);
const optionalText = (maxLength: number) => z.string().trim().max(maxLength).nullable();

const itemFields = {
  /** Null: uncategorized. */
  categoryId: z.uuid().nullable(),
  name: text(80),
  unit: optionalText(20),
  displayQty: optionalText(20),
  note: optionalText(500),
};

/** Single and each items need exactly 1; a qty item needs at least 2 (SPEC §3). */
const validQuantity = (i: { kind: string; quantityNeeded: number }) =>
  i.kind === 'qty' ? i.quantityNeeded >= 2 : i.quantityNeeded === 1;
const QUANTITY_RULE = 'quantityNeeded must be 1, or at least 2 for a qty item';

const addItem = z
  .object({
    ...itemFields,
    list: z.enum(LISTS),
    kind: z.enum(KINDS),
    quantityNeeded: z.int().min(1).max(999).default(1),
    categoryId: itemFields.categoryId.optional(),
    unit: itemFields.unit.optional(),
    displayQty: itemFields.displayQty.optional(),
    note: itemFields.note.optional(),
  })
  .refine(validQuantity, { message: QUANTITY_RULE, path: ['quantityNeeded'] });
const editItem = z
  .object({
    ...itemFields,
    list: z.enum(LISTS),
    kind: z.enum(KINDS),
    quantityNeeded: z.int().min(1).max(999),
  })
  .partial();

/**
 * The category an item is put into, locked so it can't be deleted meanwhile. Lock order:
 * trip → member → category → item → claims.
 */
async function categoryFor(tx: Tx, tripId: string, categoryId: string | null | undefined) {
  return categoryId ? lockCategory(tx, tripId, categoryId) : undefined;
}
const CATEGORY_RULE = 'The category is on the other list';

const tripParam = z.object({ tripId: z.uuid() });
const itemParam = z.object({ tripId: z.uuid(), itemId: z.uuid() });

/**
 * The bring and buy lists. Any active member may change them. An edit may change any field, as
 * long as the item stays valid: the kind only while nobody claimed it, the quantity never below
 * what's claimed, and a bought item stays on the buy list.
 */
export const itemRoutes = (auth: Auth, db: Db) =>
  new Hono()
    .use(requireUser(auth))

    .post('/:tripId/items', validate('param', tripParam), validate('json', addItem), async (c) => {
      const { tripId } = c.req.valid('param');
      const input = c.req.valid('json');
      const me = c.var.user.id;
      const item = await transact(db, async (tx) => {
        await requireMember(tx, tripId, me, { lock: true });
        const category = await categoryFor(tx, tripId, input.categoryId);
        if (category && category.list !== input.list) throw fail(400, CATEGORY_RULE);
        const created = await appendItem(tx, tripId, me, input);
        await logActivity(tx, tripId, me, 'item_added', { itemId: created.id, name: created.name });
        return created;
      });
      return c.json(toItem(item), 201);
    })

    .patch(
      '/:tripId/items/:itemId',
      validate('param', itemParam),
      validate('json', editItem),
      async (c) => {
        const { tripId, itemId } = c.req.valid('param');
        const changes = c.req.valid('json');
        const me = c.var.user.id;
        const item = await transact(db, async (tx) => {
          await requireMember(tx, tripId, me, { lock: true });
          const category = await categoryFor(tx, tripId, changes.categoryId);
          const current = await lockItem(tx, tripId, itemId);
          // Moved to the other list without picking a category there: uncategorized.
          if (changes.list && changes.list !== current.list && !('categoryId' in changes)) {
            changes.categoryId = null;
          }
          const changed = Object.fromEntries(
            Object.entries(changes).filter(([k, v]) => v !== current[k as keyof typeof current]),
          ) as typeof changes;
          const fields = Object.keys(changed);
          if (fields.length === 0) return current;

          const next = { ...current, ...changed };
          if (!validQuantity(next)) throw fail(400, QUANTITY_RULE);
          if (category && category.list !== next.list) throw fail(400, CATEGORY_RULE);
          if (changed.kind || changed.quantityNeeded) {
            const claimed = claimedQuantity(itemId, await lockClaims(tx, itemId));
            // A claim means something else per kind (a share, the whole item, "I have mine"),
            // so there is no safe conversion: the kind changes only before anyone claims.
            if (changed.kind && claimed > 0) throw fail(409, 'Already claimed');
            if (next.quantityNeeded < claimed) throw fail(409, 'Less than already claimed');
          }
          // The bring list has no purchases: unmark it as bought first.
          if (changed.list === 'bring' && (await findPurchase(tx, itemId))) {
            throw fail(409, 'Already bought');
          }

          // Moved to the other list: at its end, like a new item.
          const updated = await updateItem(
            tx,
            itemId,
            changed.list
              ? { ...changed, position: await endOfList(tx, tripId, changed.list) }
              : changed,
          );
          await logActivity(tx, tripId, me, 'item_updated', { itemId, name: updated.name, fields });
          return updated;
        });
        return c.json(toItem(item));
      },
    )

    // Soft delete: the item and its claims disappear from the trip, the history stays.
    .delete('/:tripId/items/:itemId', validate('param', itemParam), async (c) => {
      const { tripId, itemId } = c.req.valid('param');
      const me = c.var.user.id;
      await transact(db, async (tx) => {
        await requireMember(tx, tripId, me, { lock: true });
        const item = await lockItem(tx, tripId, itemId);
        await deleteItem(tx, itemId);
        await logActivity(tx, tripId, me, 'item_deleted', { itemId, name: item.name });
      });
      return c.body(null, 204);
    })

    // Sets my claim on an item; 0 drops it. Never past what's still needed (SPEC §4).
    .put(
      '/:tripId/items/:itemId/claim',
      validate('param', itemParam),
      validate('json', z.object({ quantity: z.int().min(0).max(999) })),
      async (c) => {
        const { tripId, itemId } = c.req.valid('param');
        const { quantity } = c.req.valid('json');
        const me = c.var.user.id;
        await transact(db, async (tx) => {
          await requireMember(tx, tripId, me, { lock: true });
          const item = await lockItem(tx, tripId, itemId);
          const current = await lockClaims(tx, itemId);
          const cap = claimCap(toItem(item), current, me);
          if (quantity > cap) throw fail(409, `At most ${cap} can be claimed`);
          const had = current.find((cl) => cl.userId === me);
          await setClaim(tx, itemId, me, quantity, had);
          await logActivity(tx, tripId, me, 'claim_set', { itemId, quantity });
        });
        return c.json({ itemId, userId: me, quantity });
      },
    )

    // Packs or unpacks my claim on an item (packing spec §4). Only the claim's owner can: there's
    // no way to name anyone else's. Everyone sees it, through the usual trip refetch.
    .put(
      '/:tripId/items/:itemId/packed',
      validate('param', itemParam),
      validate('json', z.object({ packed: z.boolean() })),
      async (c) => {
        const { tripId, itemId } = c.req.valid('param');
        const { packed } = c.req.valid('json');
        const me = c.var.user.id;
        await transact(db, async (tx) => {
          await requireMember(tx, tripId, me, { lock: true });
          await lockItem(tx, tripId, itemId);
          if (!(await setPacked(tx, itemId, me, packed))) throw fail(409, 'Not claimed by you');
        });
        return c.json({ itemId, userId: me, packed });
      },
    );
