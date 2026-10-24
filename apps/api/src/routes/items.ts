import { claimCap, claimedQuantity } from '@yallist/domain';
import { and, eq, isNull, max } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { fail, logActivity, requireMember, validate } from '../access';
import { requireUser, type Auth } from '../auth';
import type { Db } from '../db/client';
import { claims, items, KINDS, LISTS } from '../db/schema';
import { transact, type Tx } from '../db/tx';
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

/** A live item of the trip, locked: claims and edits on one item run one at a time. */
async function lockItem(tx: Tx, tripId: string, itemId: string) {
  const [item] = await tx
    .select()
    .from(items)
    .where(and(eq(items.id, itemId), eq(items.tripId, tripId), isNull(items.deletedAt)))
    .for('update');
  if (!item) throw fail(404, 'Item not found');
  return item;
}

const lockClaims = (tx: Tx, itemId: string) =>
  tx.select().from(claims).where(eq(claims.itemId, itemId)).for('update');

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
        const [last] = await tx
          .select({ position: max(items.position) })
          .from(items)
          .where(and(eq(items.tripId, tripId), eq(items.list, input.list)));
        const [created] = await tx
          .insert(items)
          .values({ ...input, tripId, position: (last?.position ?? -1) + 1, createdBy: me })
          .returning();
        await logActivity(tx, tripId, me, 'item_added', {
          itemId: created!.id,
          name: created!.name,
        });
        return created!;
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
          const [updated] = await tx
            .update(items)
            .set(changes)
            .where(eq(items.id, itemId))
            .returning();
          await logActivity(tx, tripId, me, 'item_updated', {
            itemId,
            fields: Object.keys(changes),
          });
          return updated!;
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
        await tx.update(items).set({ deletedAt: new Date() }).where(eq(items.id, itemId));
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

          const mine = and(eq(claims.itemId, itemId), eq(claims.userId, me));
          const had = current.some((cl) => cl.userId === me);
          if (quantity === 0) await tx.delete(claims).where(mine);
          else if (had) await tx.update(claims).set({ quantity }).where(mine);
          else await tx.insert(claims).values({ itemId, userId: me, quantity });
          await logActivity(tx, tripId, me, 'claim_set', { itemId, quantity });
        });
        return c.json({ itemId, userId: me, quantity });
      },
    );
