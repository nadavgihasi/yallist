import { BULK_MAX_ITEMS, ITEM_NAME_MAX, ITEM_QUANTITY_MAX, type BulkItem } from '@yallist/domain';
import { Hono } from 'hono';
import { z } from 'zod';

import { fail, validate } from '../access';
import { requireUser, type Auth } from '../auth';
import { logActivity } from '../dal/activity';
import { addItems, copyableItems } from '../dal/bulk-items';
import { requireMember } from '../dal/members';
import { lockTrip } from '../dal/trips';
import type { Db } from '../db/client';
import { KINDS, LISTS } from '../db/schema';
import { transact, type Tx } from '../db/tx';
import { toItem } from '../trip-data';

const text = (maxLength: number) => z.string().trim().min(1).max(maxLength);
const optionalText = (maxLength: number) => z.string().trim().max(maxLength).nullable().optional();

const bulkItem = z
  .object({
    list: z.enum(LISTS),
    name: text(ITEM_NAME_MAX),
    kind: z.enum(KINDS),
    quantityNeeded: z.int().min(1).max(ITEM_QUANTITY_MAX),
    /** The category's name: the list's own of that name, or a new one. Null: uncategorized. */
    category: z.string().trim().max(40).nullable(),
    unit: optionalText(20),
    displayQty: optionalText(20),
  })
  // Single and each items need exactly 1; a qty item needs at least 2 (SPEC §3).
  .refine((i) => (i.kind === 'qty' ? i.quantityNeeded >= 2 : i.quantityNeeded === 1), {
    message: 'quantityNeeded must be 1, or at least 2 for a qty item',
    path: ['quantityNeeded'],
  });

/** At most BULK_MAX_ITEMS: with their categories and the activity row, far below DSQL's 3,000. */
const bulkAdd = z.object({ items: z.array(bulkItem).min(1).max(BULK_MAX_ITEMS) });

/** Another trip's items, by id: the same cap. */
const copyItems = z.object({
  fromTripId: z.uuid(),
  itemIds: z.array(z.uuid()).min(1).max(BULK_MAX_ITEMS),
});

const tripParam = z.object({ tripId: z.uuid() });

/**
 * Adds the items to the trip, one activity entry for them all. Lock order trip → member →
 * category, as category writes take it: new categories can't race another member's of the same
 * name, nor two batches the same item.
 */
async function addToTrip(
  tx: Tx,
  tripId: string,
  me: string,
  load: () => Promise<BulkItem[]>,
  activity: Record<string, unknown> = {},
) {
  await lockTrip(tx, tripId);
  await requireMember(tx, tripId, me, { lock: true });
  const { added, skipped } = await addItems(tx, tripId, me, await load());
  if (added.length > 0) {
    await logActivity(tx, tripId, me, 'items_added', {
      count: added.length,
      names: added.map((i) => i.name),
      ...activity,
    });
  }
  return { added: added.map(toItem), skipped: skipped.map((i) => i.name) };
}

/**
 * Adding many items at once: typed lines and ticked suggestions (`bulk`), or what another trip of
 * mine had (`copy`). One request, one transaction, one activity entry. What the lists already
 * have is skipped and answered as `skipped`.
 */
export const bulkItemRoutes = (auth: Auth, db: Db) =>
  new Hono()
    .use(requireUser(auth))

    .post(
      '/:tripId/items/bulk',
      validate('param', tripParam),
      validate('json', bulkAdd),
      async (c) => {
        const { tripId } = c.req.valid('param');
        const { items } = c.req.valid('json');
        const me = c.var.user.id;
        const result = await transact(db, (tx) => addToTrip(tx, tripId, me, async () => items));
        return c.json(result, 201);
      },
    )

    // Copies items of a trip I'm an active member of (ended ones too): what they are, not their
    // claims, purchases or notes, which belong to that trip.
    .post(
      '/:tripId/items/copy',
      validate('param', tripParam),
      validate('json', copyItems),
      async (c) => {
        const { tripId } = c.req.valid('param');
        const { fromTripId, itemIds } = c.req.valid('json');
        const me = c.var.user.id;
        if (fromTripId === tripId) throw fail(400, 'Copy from another trip');
        const result = await transact(db, (tx) =>
          addToTrip(
            tx,
            tripId,
            me,
            async () => {
              await requireMember(tx, fromTripId, me);
              return copyableItems(tx, fromTripId, itemIds);
            },
            { fromTripId },
          ),
        );
        return c.json(result, 201);
      },
    );
