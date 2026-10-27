import { Hono } from 'hono';
import { z } from 'zod';

import { fail, validate } from '../access';
import { requireUser, type Auth } from '../auth';
import { logActivity } from '../dal/activity';
import { lockClaims } from '../dal/claims';
import { findPurchase, insertExpense } from '../dal/expenses';
import { findItem } from '../dal/items';
import { activeUserIds, requireMember } from '../dal/members';
import {
  claimForRun,
  endRun,
  findActiveRun,
  insertRun,
  lockActiveRun,
  runClaims,
  setInCart,
  toRun,
} from '../dal/runs';
import type { Db } from '../db/client';
import { transact, type Tx } from '../db/tx';
import { toExpense } from '../trip-data';

const tripParam = z.object({ tripId: z.uuid() });
const runParam = z.object({ tripId: z.uuid(), runId: z.uuid() });
const itemParam = z.object({ tripId: z.uuid(), itemId: z.uuid() });

/** ₪100,000: one supermarket bill, with room to spare. */
const MAX_RUN_AGOROT = 10_000_000;

/** `קניות · 4 פריטים`: the run's expense, as the money tab lists it. */
const runDescription = (n: number) => `קניות · ${n === 1 ? 'פריט אחד' : `${n} פריטים`}`;

/**
 * Locks the item and says why a run can't claim it, if it can't: who has it, or that it's gone,
 * bought, or not a shared buy item (an `each` item is everyone's own purchase, never one
 * expense). Locking the item serializes runs and claims on it: on Postgres the second waits;
 * on DSQL, where FOR UPDATE counts the row as written, the second fails at commit and its
 * transaction is retried, now seeing the first one's claim.
 */
async function ineligible(tx: Tx, tripId: string, itemId: string) {
  const item = await findItem(tx, tripId, itemId, { lock: true });
  if (item?.list !== 'buy' || item.kind === 'each') return { item, reason: 'gone' as const };
  const [claim] = await lockClaims(tx, itemId);
  if (claim) return { item, reason: 'claimed' as const, claimedBy: claim.userId };
  if (await findPurchase(tx, itemId)) return { item, reason: 'bought' as const };
  return { item };
}

/**
 * Shopping runs (PACKING_SHOPPING_SPEC §4): one shopper claims many buy items at once, checks
 * them off in the store, and pays once. Only the shopper changes their run.
 */
export const runRoutes = (auth: Auth, db: Db) =>
  new Hono()
    .use(requireUser(auth))

    // Claims every eligible item for my active run in the trip, starting one if I have none.
    // Items someone else got first come back in `skipped`.
    .post(
      '/:tripId/runs',
      validate('param', tripParam),
      validate('json', z.object({ itemIds: z.array(z.uuid()).min(1).max(200) })),
      async (c) => {
        const { tripId } = c.req.valid('param');
        const me = c.var.user.id;
        // Sorted, so two runs lock shared items in the same order (no deadlock on Postgres).
        const itemIds = [...new Set(c.req.valid('json').itemIds)].sort();
        const result = await transact(db, async (tx) => {
          await requireMember(tx, tripId, me, { lock: true });
          const eligible = [];
          const skipped: { itemId: string; claimedBy: string | null }[] = [];
          for (const itemId of itemIds) {
            const { item, reason, claimedBy } = await ineligible(tx, tripId, itemId);
            if (reason) skipped.push({ itemId, claimedBy: claimedBy ?? null });
            else eligible.push(item);
          }
          let run = await findActiveRun(tx, tripId, me);
          if (!run && eligible.length === 0) return { run: null, claimed: [], skipped };
          if (!run) {
            run = await insertRun(tx, tripId, me);
            await logActivity(tx, tripId, me, 'shopping_started', {
              runId: run.id,
              count: eligible.length,
            });
          }
          for (const item of eligible) await claimForRun(tx, run, item);
          return { run: toRun(run), claimed: eligible.map((i) => i.id), skipped };
        });
        return c.json(result);
      },
    )

    // One more item for my run, such as one someone added while I'm in the store.
    .post(
      '/:tripId/runs/:runId/items',
      validate('param', runParam),
      validate('json', z.object({ itemId: z.uuid() })),
      async (c) => {
        const { tripId, runId } = c.req.valid('param');
        const { itemId } = c.req.valid('json');
        const me = c.var.user.id;
        await transact(db, async (tx) => {
          await requireMember(tx, tripId, me, { lock: true });
          const run = await lockActiveRun(tx, tripId, runId, me);
          const { item, reason } = await ineligible(tx, tripId, itemId);
          if (reason === 'gone') throw fail(404, 'Item not found');
          if (reason === 'claimed') throw fail(409, 'Already claimed');
          if (reason === 'bought') throw fail(409, 'Already bought');
          await claimForRun(tx, run, item);
        });
        return c.json({ runId, itemId });
      },
    )

    // Checks my run's item off in the store, or puts it back.
    .put(
      '/:tripId/items/:itemId/cart',
      validate('param', itemParam),
      validate('json', z.object({ inCart: z.boolean() })),
      async (c) => {
        const { tripId, itemId } = c.req.valid('param');
        const { inCart } = c.req.valid('json');
        const me = c.var.user.id;
        await transact(db, async (tx) => {
          await requireMember(tx, tripId, me, { lock: true });
          const claim = (await lockClaims(tx, itemId)).find((cl) => cl.userId === me);
          if (!claim?.runId) throw fail(409, 'Not in your shopping run');
          // Locked, so a finish or cancel can't slip in between.
          await lockActiveRun(tx, tripId, claim.runId, me);
          await setInCart(tx, itemId, me, inCart);
        });
        return c.json({ itemId, inCart });
      },
    )

    // At the till: one expense for everything in the cart, split between `shares`; the rest goes
    // back to the list.
    .post(
      '/:tripId/runs/:runId/finish',
      validate('param', runParam),
      validate(
        'json',
        z.object({
          amountAgorot: z.int().min(1).max(MAX_RUN_AGOROT),
          shares: z.array(z.uuid()).min(1).max(100),
        }),
      ),
      async (c) => {
        const { tripId, runId } = c.req.valid('param');
        const { amountAgorot } = c.req.valid('json');
        const shares = [...new Set(c.req.valid('json').shares)];
        const me = c.var.user.id;
        const result = await transact(db, async (tx) => {
          await requireMember(tx, tripId, me, { lock: true });
          await lockActiveRun(tx, tripId, runId, me);
          const active = await activeUserIds(tx, tripId);
          if (!shares.every((id) => active.has(id))) {
            throw fail(400, 'Every share must be an active member');
          }
          // In the cart, still on the list, and not bought meanwhile (by the single-item flow).
          // Locked like any purchase, so the item can't be bought twice.
          const bought: string[] = [];
          const cart = (await runClaims(tx, runId)).filter((cl) => cl.inCart);
          for (const { itemId } of cart.sort((a, b) => a.itemId.localeCompare(b.itemId))) {
            const item = await findItem(tx, tripId, itemId, { lock: true });
            if (item && !(await findPurchase(tx, itemId))) bought.push(itemId);
          }
          if (bought.length === 0) throw fail(409, 'Nothing in the cart');

          const expense = await insertExpense(
            tx,
            {
              tripId,
              description: runDescription(bought.length),
              amountAgorot,
              paidBy: me,
              createdBy: me,
              itemId: bought.length === 1 ? bought[0] : null,
            },
            shares,
            bought,
          );
          await endRun(tx, runId, { status: 'done', expenseId: expense.id });
          await logActivity(tx, tripId, me, 'shopping_finished', {
            runId,
            expenseId: expense.id,
            count: bought.length,
            amountAgorot,
          });
          return toExpense(expense, shares, bought);
        });
        return c.json(result, 201);
      },
    )

    // Gives up: every item of the run goes back to the list.
    .post('/:tripId/runs/:runId/cancel', validate('param', runParam), async (c) => {
      const { tripId, runId } = c.req.valid('param');
      const me = c.var.user.id;
      await transact(db, async (tx) => {
        await requireMember(tx, tripId, me, { lock: true });
        await lockActiveRun(tx, tripId, runId, me);
        await endRun(tx, runId, { status: 'cancelled' });
        await logActivity(tx, tripId, me, 'shopping_cancelled', { runId });
      });
      return c.json({ runId, status: 'cancelled' as const });
    });
