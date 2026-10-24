import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { fail, logActivity, requireMember, validate } from '../access';
import { requireUser, type Auth } from '../auth';
import type { Db } from '../db/client';
import { expenseShares, expenses, items, payments, tripMembers } from '../db/schema';
import { transact, type Tx } from '../db/tx';
import { toExpense } from '../trip-data';

/** Agorot, positive; ₪1M is far beyond any trip and well inside a Postgres integer. */
const agorot = z.int().min(1).max(100_000_000);

const addExpense = z.object({
  description: z.string().trim().min(1).max(80),
  amountAgorot: agorot,
  /** Defaults to the caller. */
  paidBy: z.uuid().optional(),
  /** The active members it is split between, equally (SPEC §4). */
  shares: z.array(z.uuid()).min(1).max(100),
  /** A buy-list item this purchase covers; it then counts as bought. */
  itemId: z.uuid().optional(),
});

const tripParam = z.object({ tripId: z.uuid() });
const expenseParam = z.object({ tripId: z.uuid(), expenseId: z.uuid() });
const paymentParam = z.object({ tripId: z.uuid(), paymentId: z.uuid() });

async function activeMemberIds(tx: Tx, tripId: string) {
  const rows = await tx
    .select({ userId: tripMembers.userId })
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.status, 'active')));
  return new Set(rows.map((r) => r.userId));
}

async function lockPayment(tx: Tx, tripId: string, paymentId: string) {
  const [payment] = await tx
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.tripId, tripId)))
    .for('update');
  if (!payment) throw fail(404, 'Payment not found');
  return payment;
}

/** Expenses and settle-up payments. Balances and suggested transfers come with the trip data. */
export const moneyRoutes = (auth: Auth, db: Db) =>
  new Hono()
    .use(requireUser(auth))

    .post(
      '/:tripId/expenses',
      validate('param', tripParam),
      validate('json', addExpense),
      async (c) => {
        const { tripId } = c.req.valid('param');
        const { shares: shareIds, paidBy = c.var.user.id, ...input } = c.req.valid('json');
        const me = c.var.user.id;
        const shares = [...new Set(shareIds)];
        const expense = await transact(db, async (tx) => {
          await requireMember(tx, tripId, me, { lock: true });
          const active = await activeMemberIds(tx, tripId);
          if (!active.has(paidBy)) throw fail(400, 'paidBy is not an active member');
          if (!shares.every((id) => active.has(id))) {
            throw fail(400, 'Every share must be an active member');
          }
          if (input.itemId) {
            // Locked, so two purchases of one item can't both go through.
            const [item] = await tx
              .select()
              .from(items)
              .where(
                and(eq(items.id, input.itemId), eq(items.tripId, tripId), isNull(items.deletedAt)),
              )
              .for('update');
            if (item?.list !== 'buy') throw fail(400, 'itemId is not on the buy list');
            const [bought] = await tx
              .select({ id: expenses.id })
              .from(expenses)
              .where(eq(expenses.itemId, input.itemId));
            if (bought) throw fail(409, 'Already bought');
          }
          const [created] = await tx
            .insert(expenses)
            .values({ ...input, tripId, paidBy, createdBy: me })
            .returning();
          await tx
            .insert(expenseShares)
            .values(shares.map((userId) => ({ expenseId: created!.id, userId })));
          await logActivity(tx, tripId, me, 'expense_added', {
            expenseId: created!.id,
            amountAgorot: created!.amountAgorot,
          });
          return created!;
        });
        return c.json(toExpense(expense, shares), 201);
      },
    )

    // By whoever added it, whoever paid, or an organizer.
    .delete('/:tripId/expenses/:expenseId', validate('param', expenseParam), async (c) => {
      const { tripId, expenseId } = c.req.valid('param');
      const me = c.var.user.id;
      await transact(db, async (tx) => {
        const member = await requireMember(tx, tripId, me, { lock: true });
        const [expense] = await tx
          .select()
          .from(expenses)
          .where(and(eq(expenses.id, expenseId), eq(expenses.tripId, tripId)))
          .for('update');
        if (!expense) throw fail(404, 'Expense not found');
        if (expense.createdBy !== me && expense.paidBy !== me && member.role !== 'organizer') {
          throw fail(403, 'Only who added or paid it, or an organizer');
        }
        // No cascades on DSQL: shares go first, in the same transaction.
        await tx.delete(expenseShares).where(eq(expenseShares.expenseId, expenseId));
        await tx.delete(expenses).where(eq(expenses.id, expenseId));
        await logActivity(tx, tripId, me, 'expense_deleted', {
          expenseId,
          amountAgorot: expense.amountAgorot,
        });
      });
      return c.body(null, 204);
    })

    // I paid someone back.
    .post(
      '/:tripId/payments',
      validate('param', tripParam),
      validate('json', z.object({ toUser: z.uuid(), amountAgorot: agorot })),
      async (c) => {
        const { tripId } = c.req.valid('param');
        const { toUser, amountAgorot } = c.req.valid('json');
        const me = c.var.user.id;
        if (toUser === me) throw fail(400, 'Cannot pay yourself');
        const payment = await transact(db, async (tx) => {
          await requireMember(tx, tripId, me, { lock: true });
          if (!(await activeMemberIds(tx, tripId)).has(toUser)) {
            throw fail(400, 'toUser is not an active member');
          }
          const [created] = await tx
            .insert(payments)
            .values({ tripId, fromUser: me, toUser, amountAgorot })
            .returning();
          await logActivity(tx, tripId, me, 'payment_marked', {
            paymentId: created!.id,
            toUser,
            amountAgorot,
          });
          return created!;
        });
        return c.json(
          { id: payment.id, fromUser: me, toUser, amountAgorot, status: payment.status },
          201,
        );
      },
    )

    // The receiver confirms the money arrived.
    .post('/:tripId/payments/:paymentId/confirm', validate('param', paymentParam), async (c) => {
      const { tripId, paymentId } = c.req.valid('param');
      const me = c.var.user.id;
      await transact(db, async (tx) => {
        await requireMember(tx, tripId, me, { lock: true });
        const payment = await lockPayment(tx, tripId, paymentId);
        if (payment.toUser !== me) throw fail(403, 'Only the receiver confirms');
        if (payment.status === 'confirmed') return;
        await tx
          .update(payments)
          .set({ status: 'confirmed', confirmedAt: new Date() })
          .where(eq(payments.id, paymentId));
        await logActivity(tx, tripId, me, 'payment_confirmed', { paymentId });
      });
      return c.json({ id: paymentId, status: 'confirmed' as const });
    })

    // The sender takes back a payment the receiver hasn't confirmed yet.
    .delete('/:tripId/payments/:paymentId', validate('param', paymentParam), async (c) => {
      const { tripId, paymentId } = c.req.valid('param');
      const me = c.var.user.id;
      await transact(db, async (tx) => {
        await requireMember(tx, tripId, me, { lock: true });
        const payment = await lockPayment(tx, tripId, paymentId);
        if (payment.fromUser !== me) throw fail(403, 'Only the sender deletes');
        if (payment.status === 'confirmed') throw fail(409, 'Already confirmed');
        await tx.delete(payments).where(eq(payments.id, paymentId));
        await logActivity(tx, tripId, me, 'payment_deleted', { paymentId });
      });
      return c.body(null, 204);
    });
