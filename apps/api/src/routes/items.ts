import { claimCap, claimedQuantity } from '@yallist/domain';
import { Hono } from 'hono';
import { z } from 'zod';

import { fail, validate } from '../access';
import { requireUser, type Auth } from '../auth';
import { logActivity } from '../dal/activity';
import { lockClaims, setClaim } from '../dal/claims';
import { appendItem, deleteItem, lockItem, updateItem } from '../dal/items';
import { requireMember } from '../dal/members';
import type { Db } from '../db/client';
import { KINDS, LISTS } from '../db/schema';
import { transact } from '../db/tx';
import { toItem } from '../trip-data';

const text = (maxLength: number) => z.string().trim().min(1).max(maxLength);
const optionalText = (maxLength: number) => z.string().trim().max(maxLength).nullable();

const itemFields = {
  category: text(40),
  name: text(80),
  unit: optionalText(20),
  displayQty: optionalText(20),
  note: optionalText(500),
};

/** Single and each items need exactly 1; a qty item needs at least 2 (SPEC §3). */
const addItem = z
  .object({
    ...itemFields,
    list: z.enum(LISTS),
    kind: z.enum(KINDS),
    quantityNeeded: z.int().min(1).max(999).default(1),
    unit: itemFields.unit.optional(),
    displayQty: itemFields.displayQty.optional(),
    note: itemFields.note.optional(),
  })
  .refine((i) => (i.kind === 'qty' ? i.quantityNeeded >= 2 : i.quantityNeeded === 1), {
    message: 'quantityNeeded must be 1, or at least 2 for a qty item',
    path: ['quantityNeeded'],
  });
const editItem = z.object({ ...itemFields, quantityNeeded: z.int().min(2).max(999) }).partial();

const tripParam = z.object({ tripId: z.uuid() });
const itemParam = z.object({ tripId: z.uuid(), itemId: z.uuid() });

/** The bring and buy lists. Any active member may change them. */
export const itemRoutes = (auth: Auth, db: Db) =>
  new Hono()
    .use(requireUser(auth))

    .post('/:tripId/items', validate('param', tripParam), validate('json', addItem), async (c) => {
      const { tripId } = c.req.valid('param');
      const input = c.req.valid('json');
      const me = c.var.user.id;
      const item = await transact(db, async (tx) => {
        await requireMember(tx, tripId, me, { lock: true });
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
          const current = await lockItem(tx, tripId, itemId);
          if (changes.quantityNeeded !== undefined) {
            if (current.kind !== 'qty') throw fail(400, 'Only a qty item has a quantity');
            const claimed = claimedQuantity(itemId, await lockClaims(tx, itemId));
            if (changes.quantityNeeded < claimed) throw fail(409, 'Less than already claimed');
          }
          const updated = await updateItem(tx, itemId, changes);
          await logActivity(tx, tripId, me, 'item_updated', {
            itemId,
            fields: Object.keys(changes),
          });
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
          const had = current.some((cl) => cl.userId === me);
          await setClaim(tx, itemId, me, quantity, had);
          await logActivity(tx, tripId, me, 'claim_set', { itemId, quantity });
        });
        return c.json({ itemId, userId: me, quantity });
      },
    );
