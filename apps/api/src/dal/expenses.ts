import { and, eq } from 'drizzle-orm';

import { fail } from '../access';
import { expenseShares, expenses } from '../db/schema';
import type { Executor } from '../db/tx';

/** The expense and the members it is split between. */
export async function insertExpense(
  tx: Executor,
  values: typeof expenses.$inferInsert,
  shares: string[],
) {
  const [expense] = await tx.insert(expenses).values(values).returning();
  await tx
    .insert(expenseShares)
    .values(shares.map((userId) => ({ expenseId: expense!.id, userId })));
  return expense!;
}

/** The purchase that covers the item, if any. */
export async function findPurchase(tx: Executor, itemId: string) {
  const [expense] = await tx
    .select({ id: expenses.id })
    .from(expenses)
    .where(eq(expenses.itemId, itemId));
  return expense;
}

/** The trip's expense, or 404. Writes pass `lock`. */
export async function findExpense(
  tx: Executor,
  tripId: string,
  expenseId: string,
  { lock = false } = {},
) {
  const query = tx
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), eq(expenses.tripId, tripId)));
  const [expense] = await (lock ? query.for('update') : query);
  if (!expense) throw fail(404, 'Expense not found');
  return expense;
}

export const setReceiptPath = (tx: Executor, expenseId: string, receiptPath: string | null) =>
  tx.update(expenses).set({ receiptPath }).where(eq(expenses.id, expenseId));

export async function deleteExpense(tx: Executor, expenseId: string) {
  // No cascades on DSQL: shares go first, in the same transaction.
  await tx.delete(expenseShares).where(eq(expenseShares.expenseId, expenseId));
  await tx.delete(expenses).where(eq(expenses.id, expenseId));
}
