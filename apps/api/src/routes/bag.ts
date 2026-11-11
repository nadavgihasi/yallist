import type { BagItem } from '@yallist/domain';
import { Hono } from 'hono';
import { z } from 'zod';

import { fail, validate } from '../access';
import { requireUser, type Auth } from '../auth';
import { addToBag, listBag, removeFromBag, setBagQuantity } from '../dal/bag';
import { activeTripIds } from '../dal/members';
import { lockProfile } from '../dal/profiles';
import type { Db } from '../db/client';
import type { bagItems } from '../db/schema';
import { transact } from '../db/tx';

const toBagItem = ({ id, name, quantity }: typeof bagItems.$inferSelect): BagItem => ({
  id,
  name,
  quantity,
});

const entry = z.object({
  name: z.string().trim().min(1).max(80),
  quantity: z.int().min(1).max(99).default(1),
});
const bagParam = z.object({ id: z.uuid() });

/**
 * The user's bag (התיק שלי): what they always have at home. Per-person bring items of the same
 * name count as theirs in every trip (dal/bag.ts), so each change refreshes their trips for
 * everyone in them.
 */
export const bagRoutes = (auth: Auth, db: Db, notify: (tripId: string) => Promise<unknown>) => {
  const refreshTrips = async (userId: string) => {
    const tripIds = await activeTripIds(db, userId);
    await Promise.all(tripIds.map(notify));
  };
  const bagOf = async (userId: string) => ({ items: (await listBag(db, userId)).map(toBagItem) });

  return (
    new Hono()
      .use(requireUser(auth))

      .get('/', async (c) => c.json(await bagOf(c.var.user.id)))

      // Adds what isn't in the bag yet: one item, or what a trip brought, once it ended;
      // names already there are left as they are. Answers with the whole bag.
      .post(
        '/',
        validate('json', z.object({ items: z.array(entry).min(1).max(100) })),
        async (c) => {
          const me = c.var.user.id;
          await transact(db, async (tx) => {
            await lockProfile(tx, me);
            await addToBag(tx, me, c.req.valid('json').items);
          });
          await refreshTrips(me);
          return c.json(await bagOf(me), 201);
        },
      )

      .patch(
        '/:id',
        validate('param', bagParam),
        validate('json', z.object({ quantity: entry.shape.quantity.unwrap() })),
        async (c) => {
          const me = c.var.user.id;
          const row = await setBagQuantity(
            db,
            me,
            c.req.valid('param').id,
            c.req.valid('json').quantity,
          );
          if (!row) throw fail(404, 'Not in your bag');
          return c.json(toBagItem(row));
        },
      )

      // Leaves the user's open trips; one that already ended keeps it (dal/bag.ts).
      .delete('/:id', validate('param', bagParam), async (c) => {
        const me = c.var.user.id;
        if (!(await removeFromBag(db, me, c.req.valid('param').id))) {
          throw fail(404, 'Not in your bag');
        }
        await refreshTrips(me);
        return c.body(null, 204);
      })
  );
};
