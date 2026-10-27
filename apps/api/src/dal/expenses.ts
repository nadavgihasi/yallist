import { and, eq } from 'drizzle-orm';

import { fail } from '../access';
import { expenseItems, expenseShares, expenses, shoppingRuns } from '../db/schema';
import type { Executor } from '../db/tx';

/** The expense, the members it is split between, and the buy items it covers. */
export async function insertExpense(
  tx: Executor,
  values: typeof expenses.$inferInsert,
  shares: string[],
  itemIds: string[] = [],
) {
  const [expense] = await tx.insert(expenses).values(values).returning();
  await tx
    .insert(expenseShares)
    .values(shares.map((userId) => ({ expenseId: expense!.id, userId })));
  if (itemIds.length > 0) {
    await tx
      .insert(expenseItems)
      .values(itemIds.map((itemId) => ({ expenseId: expense!.id, itemId })));
  }
  return expense!;
}

/** The purchase that covers the item, if any. */
export async function findPurchase(tx: Executor, itemId: string) {
  const [purchase] = await tx
    .select({ id: expenseItems.expenseId })
    .from(expenseItems)
    .where(eq(expenseItems.itemId, itemId));
  return purchase;
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
  // No cascades on DSQL: what refers to it goes first, in the same transaction. Its items are
  // no longer bought; a shopping run it finished keeps its history without it.
  await tx.delete(expenseShares).where(eq(expenseShares.expenseId, expenseId));
  await tx.delete(expenseItems).where(eq(expenseItems.expenseId, expenseId));
  await tx
    .update(shoppingRuns)
    .set({ expenseId: null })
    .where(eq(shoppingRuns.expenseId, expenseId));
  await tx.delete(expenses).where(eq(expenses.id, expenseId));
}
