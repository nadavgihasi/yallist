import { MAX_WEIGHT } from '@yallist/domain';
import { Hono } from 'hono';
import { z } from 'zod';

import { fail, validate } from '../access';
import { requireUser, type Auth } from '../auth';
import { logActivity } from '../dal/activity';
import {
  deleteExpense,
  expenseSplit,
  findExpense,
  findPurchase,
  insertExpense,
  updateExpense,
} from '../dal/expenses';
import { findItem } from '../dal/items';
import { activeUserIds, findMember, requireMember } from '../dal/members';
import { deletePayment, insertPayment, lockPayment } from '../dal/payments';
import type { Db } from '../db/client';
import type { expenses, tripMembers } from '../db/schema';
import { transact } from '../db/tx';
import { deleteReceipt, type ReceiptStore } from '../receipts';
import { toExpense, toPayment } from '../trip-data';

import { assertPartsFit, MAX_PARTS, part } from './runs';

/** Agorot, positive; ₪1M is far beyond any trip and well inside a Postgres integer. */
const agorot = z.int().min(1).max(100_000_000);

/** By user id, 1 to MAX_WEIGHT; see `Expense.weights`. */
const weights = z.record(z.uuid(), z.int().min(1).max(MAX_WEIGHT));

/** Weights only for people who share the expense. */
function assertWeightsFit(weightsIn: Record<string, number>, shares: string[]) {
  if (!Object.keys(weightsIn).every((id) => shares.includes(id))) {
    throw fail(400, 'Weights are for people who share the expense');
  }
}

/** `YYYY-MM-DD`, as trips' dates. */
const spentOn = z.iso.date();

const addExpense = z.object({
  description: z.string().trim().min(1).max(80),
  amountAgorot: agorot,
  /** Defaults to the caller. */
  paidBy: z.uuid().optional(),
  /** The active members it is split between: what any parts leave, by their weights. */
  shares: z.array(z.uuid()).min(1).max(100),
  /** A buy-list item this purchase covers; it then counts as bought. */
  itemId: z.uuid().optional(),
  /** Amounts split between some of the trip only, as at a shopping run's checkout. */
  parts: z.array(part).max(MAX_PARTS).optional(),
  /** How many shares of the rest some of `shares` take; anyone else takes 1. */
  weights: weights.optional(),
  /** The day it was spent, when not today. */
  spentOn: spentOn.optional(),
});

/**
 * A change to an expense: only the fields given change. `shares`, `weights` and `parts` replace
 * what it had; `parts: []` drops its parts, `weights: {}` its weights. New `shares` without
 * `weights` keep the weights of those still in.
 */
const editExpense = z.object({
  description: z.string().trim().min(1).max(80).optional(),
  amountAgorot: agorot.optional(),
  paidBy: z.uuid().optional(),
  shares: z.array(z.uuid()).min(1).max(100).optional(),
  parts: z.array(part).max(MAX_PARTS).optional(),
  weights: weights.optional(),
  spentOn: spentOn.optional(),
});

const tripParam = z.object({ tripId: z.uuid() });
const expenseParam = z.object({ tripId: z.uuid(), expenseId: z.uuid() });
const paymentParam = z.object({ tripId: z.uuid(), paymentId: z.uuid() });

/** Editing or deleting an expense or its receipt: whoever added it, whoever paid, or an organizer. */
export function assertMayChange(
  expense: typeof expenses.$inferSelect,
  member: typeof tripMembers.$inferSelect,
) {
  const me = member.userId;
  if (expense.createdBy !== me && expense.paidBy !== me && member.role !== 'organizer') {
    throw fail(403, 'Only who added or paid it, or an organizer');
  }
}

/** Expenses and settle-up payments. Balances and suggested transfers come with the trip data. */
export const moneyRoutes = (auth: Auth, db: Db, receipts: ReceiptStore) =>
  new Hono()
    .use(requireUser(auth))

    .post(
      '/:tripId/expenses',
      validate('param', tripParam),
      validate('json', addExpense),
      async (c) => {
        const { tripId } = c.req.valid('param');
        const {
          shares: shareIds,
          paidBy = c.var.user.id,
          parts: partsIn = [],
          weights: weightsIn = {},
          ...input
        } = c.req.valid('json');
        const me = c.var.user.id;
        const shares = [...new Set(shareIds)];
        const parts = partsIn.map((p) => ({ ...p, shares: [...new Set(p.shares)] }));
        assertWeightsFit(weightsIn, shares);
        assertPartsFit(parts, input.amountAgorot);
        const expense = await transact(db, async (tx) => {
          await requireMember(tx, tripId, me, { lock: true });
          const active = await activeUserIds(tx, tripId);
          if (!active.has(paidBy)) throw fail(400, 'paidBy is not an active member');
          if (![...shares, ...parts.flatMap((p) => p.shares)].every((id) => active.has(id))) {
            throw fail(400, 'Every share must be an active member');
          }
          if (input.itemId) {
            // Locked, so two purchases of one item can't both go through.
            const item = await findItem(tx, tripId, input.itemId, { lock: true });
            if (item?.list !== 'buy') throw fail(400, 'itemId is not on the buy list');
            if (await findPurchase(tx, input.itemId)) throw fail(409, 'Already bought');
          }
          const created = await insertExpense(
            tx,
            { ...input, tripId, paidBy, createdBy: me },
            shares,
            input.itemId ? [input.itemId] : [],
            parts,
            weightsIn,
          );
          await logActivity(tx, tripId, me, 'expense_added', {
            expenseId: created.id,
            amountAgorot: created.amountAgorot,
          });
          return created;
        });
        return c.json(
          toExpense(
            expense,
            shares,
            input.itemId ? [input.itemId] : [],
            undefined,
            parts,
            weightsIn,
          ),
          201,
        );
      },
    )

    // Fixes an expense in place, by whoever may delete it. Its receipt and the items it covers
    // stay. Someone who left the trip can stay its payer or keep sharing it, but isn't added.
    .patch(
      '/:tripId/expenses/:expenseId',
      validate('param', expenseParam),
      validate('json', editExpense),
      async (c) => {
        const { tripId, expenseId } = c.req.valid('param');
        const {
          shares: shareIds,
          parts: partsIn,
          weights: weightsIn,
          ...values
        } = c.req.valid('json');
        const me = c.var.user.id;
        const shares = shareIds && [...new Set(shareIds)];
        const parts = partsIn?.map((p) => ({ ...p, shares: [...new Set(p.shares)] }));
        const result = await transact(db, async (tx) => {
          const member = await requireMember(tx, tripId, me, { lock: true });
          const expense = await findExpense(tx, tripId, expenseId, { lock: true });
          assertMayChange(expense, member);
          const before = await expenseSplit(tx, expenseId);
          const active = await activeUserIds(tx, tripId);
          if (values.paidBy && values.paidBy !== expense.paidBy && !active.has(values.paidBy)) {
            throw fail(400, 'paidBy is not an active member');
          }
          const had = new Set([...before.shares, ...before.parts.flatMap((p) => p.shares)]);
          const added = [...(shares ?? []), ...(parts ?? []).flatMap((p) => p.shares)];
          if (!added.every((id) => active.has(id) || had.has(id))) {
            throw fail(400, 'Every share must be an active member');
          }
          const amountAgorot = values.amountAgorot ?? expense.amountAgorot;
          assertPartsFit(parts ?? before.parts, amountAgorot);
          const nextShares = shares ?? before.shares;
          const nextWeights =
            weightsIn ??
            Object.fromEntries(
              Object.entries(before.weights).filter(([id]) => nextShares.includes(id)),
            );
          assertWeightsFit(nextWeights, nextShares);
          // Weights live on the share rows: a change to either rewrites them.
          const rewrite = shares !== undefined || weightsIn !== undefined;

          const updated = await updateExpense(tx, expenseId, values, {
            shares: rewrite ? nextShares : undefined,
            weights: nextWeights,
            parts,
          });
          await logActivity(tx, tripId, me, 'expense_edited', {
            expenseId,
            fromAgorot: expense.amountAgorot,
            amountAgorot,
          });
          return toExpense(
            updated,
            nextShares,
            before.itemIds,
            before.itemCount,
            parts ?? before.parts,
            nextWeights,
          );
        });
        return c.json(result);
      },
    )

    // By whoever added it, whoever paid, or an organizer.
    .delete('/:tripId/expenses/:expenseId', validate('param', expenseParam), async (c) => {
      const { tripId, expenseId } = c.req.valid('param');
      const me = c.var.user.id;
      const { receiptPath } = await transact(db, async (tx) => {
        const member = await requireMember(tx, tripId, me, { lock: true });
        const expense = await findExpense(tx, tripId, expenseId, { lock: true });
        assertMayChange(expense, member);
        await deleteExpense(tx, expenseId);
        await logActivity(tx, tripId, me, 'expense_deleted', {
          expenseId,
          amountAgorot: expense.amountAgorot,
        });
        return expense;
      });
      // After the commit, best effort: an orphaned photo is unreachable, not exposed.
      if (receiptPath) await deleteReceipt(receipts, receiptPath);
      return c.body(null, 204);
    })

    // Someone paid someone back. Anyone in the trip records it, for any two people in it, and it
    // counts at once: nobody confirms it. The counterparties can be former members: removal
    // leaves their balance to settle, and they can't record it themselves.
    .post(
      '/:tripId/payments',
      validate('param', tripParam),
      validate(
        'json',
        z.object({ toUser: z.uuid(), amountAgorot: agorot, fromUser: z.uuid().optional() }),
      ),
      async (c) => {
        const { tripId } = c.req.valid('param');
        const me = c.var.user.id;
        const { toUser, amountAgorot, fromUser = me } = c.req.valid('json');
        if (toUser === fromUser) throw fail(400, 'Cannot pay yourself');
        const payment = await transact(db, async (tx) => {
          await requireMember(tx, tripId, me, { lock: true });
          for (const userId of [fromUser, toUser]) {
            const member = await findMember(tx, tripId, userId);
            if (member?.status !== 'active' && member?.status !== 'removed') {
              throw fail(400, 'Not a member of the trip');
            }
          }
          const created = await insertPayment(tx, {
            tripId,
            fromUser,
            toUser,
            amountAgorot,
            status: 'confirmed',
            confirmedAt: new Date(),
            createdBy: me,
          });
          await logActivity(tx, tripId, me, 'payment_marked', {
            paymentId: created.id,
            fromUser,
            toUser,
            amountAgorot,
          });
          return created;
        });
        return c.json(toPayment(payment), 201);
      },
    )

    // A payment recorded by mistake: by whoever recorded it, either side of it, or an organizer.
    .delete('/:tripId/payments/:paymentId', validate('param', paymentParam), async (c) => {
      const { tripId, paymentId } = c.req.valid('param');
      const me = c.var.user.id;
      await transact(db, async (tx) => {
        const member = await requireMember(tx, tripId, me, { lock: true });
        const payment = toPayment(await lockPayment(tx, tripId, paymentId));
        const involved = [payment.createdBy, payment.fromUser, payment.toUser].includes(me);
        if (!involved && member.role !== 'organizer') {
          throw fail(403, 'Only who recorded it, its payer or receiver, or an organizer');
        }
        await deletePayment(tx, paymentId);
        await logActivity(tx, tripId, me, 'payment_deleted', {
          paymentId,
          fromUser: payment.fromUser,
          toUser: payment.toUser,
          amountAgorot: payment.amountAgorot,
        });
      });
      return c.body(null, 204);
    });
