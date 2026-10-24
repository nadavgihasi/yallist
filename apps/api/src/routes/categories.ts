import { Hono } from 'hono';
import { z } from 'zod';

import { fail, validate } from '../access';
import { requireUser, type Auth } from '../auth';
import { logActivity } from '../dal/activity';
import {
  appendCategory,
  assertNameFree,
  deleteCategory,
  listCategories,
  lockCategory,
  renameCategory,
  setCategoryOrder,
} from '../dal/categories';
import { requireMember } from '../dal/members';
import { lockTrip } from '../dal/trips';
import type { Db } from '../db/client';
import { LISTS } from '../db/schema';
import { transact, type Tx } from '../db/tx';
import { toCategory } from '../trip-data';

const name = z.string().trim().min(1).max(40);
const tripParam = z.object({ tripId: z.uuid() });
const categoryParam = z.object({ tripId: z.uuid(), categoryId: z.uuid() });

/**
 * Lock order trip → member: category writes run one at a time per trip, so two members can't
 * add the same name at once or reorder over each other.
 */
async function categoryWrite(tx: Tx, tripId: string, me: string) {
  await lockTrip(tx, tripId);
  await requireMember(tx, tripId, me, { lock: true });
}

/**
 * The categories of the bring and buy lists. Any active member may change them. Deleting a
 * category keeps its items: they become uncategorized.
 */
export const categoryRoutes = (auth: Auth, db: Db) =>
  new Hono()
    .use(requireUser(auth))

    .get('/:tripId/categories', validate('param', tripParam), async (c) => {
      const { tripId } = c.req.valid('param');
      const categories = await transact(db, async (tx) => {
        await requireMember(tx, tripId, c.var.user.id);
        return listCategories(tx, [tripId]);
      });
      return c.json({ categories: categories.map(toCategory) });
    })

    .post(
      '/:tripId/categories',
      validate('param', tripParam),
      validate('json', z.object({ list: z.enum(LISTS), name })),
      async (c) => {
        const { tripId } = c.req.valid('param');
        const input = c.req.valid('json');
        const me = c.var.user.id;
        const category = await transact(db, async (tx) => {
          await categoryWrite(tx, tripId, me);
          await assertNameFree(tx, tripId, input.list, input.name);
          const created = await appendCategory(tx, tripId, input.list, input.name);
          await logActivity(tx, tripId, me, 'category_added', {
            categoryId: created.id,
            name: created.name,
          });
          return created;
        });
        return c.json(toCategory(category), 201);
      },
    )

    .patch(
      '/:tripId/categories/:categoryId',
      validate('param', categoryParam),
      validate('json', z.object({ name })),
      async (c) => {
        const { tripId, categoryId } = c.req.valid('param');
        const input = c.req.valid('json');
        const me = c.var.user.id;
        const category = await transact(db, async (tx) => {
          await categoryWrite(tx, tripId, me);
          const current = await lockCategory(tx, tripId, categoryId);
          if (current.name === input.name) return current;
          await assertNameFree(tx, tripId, current.list, input.name, categoryId);
          const renamed = await renameCategory(tx, categoryId, input.name);
          await logActivity(tx, tripId, me, 'category_renamed', {
            categoryId,
            name: renamed.name,
            from: current.name,
          });
          return renamed;
        });
        return c.json(toCategory(category));
      },
    )

    // The list's categories in their new order; all of them, so a stale order is refused.
    .put(
      '/:tripId/categories/order',
      validate('param', tripParam),
      validate('json', z.object({ list: z.enum(LISTS), categoryIds: z.array(z.uuid()).max(200) })),
      async (c) => {
        const { tripId } = c.req.valid('param');
        const { list, categoryIds } = c.req.valid('json');
        const me = c.var.user.id;
        const categories = await transact(db, async (tx) => {
          await categoryWrite(tx, tripId, me);
          const current = (await listCategories(tx, [tripId])).filter((cat) => cat.list === list);
          const ids = new Set(categoryIds);
          const same =
            ids.size === categoryIds.length &&
            ids.size === current.length &&
            current.every((cat) => ids.has(cat.id));
          if (!same) {
            throw fail(409, 'Categories changed');
          }
          await setCategoryOrder(tx, categoryIds);
          await logActivity(tx, tripId, me, 'categories_reordered', { list });
          return categoryIds.map((id, position) => ({
            ...current.find((cat) => cat.id === id)!,
            position,
          }));
        });
        return c.json({ categories: categories.map(toCategory) });
      },
    )

    .delete('/:tripId/categories/:categoryId', validate('param', categoryParam), async (c) => {
      const { tripId, categoryId } = c.req.valid('param');
      const me = c.var.user.id;
      await transact(db, async (tx) => {
        await categoryWrite(tx, tripId, me);
        const category = await lockCategory(tx, tripId, categoryId);
        await deleteCategory(tx, tripId, categoryId);
        await logActivity(tx, tripId, me, 'category_deleted', { categoryId, name: category.name });
      });
      return c.body(null, 204);
    });
