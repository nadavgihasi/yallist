import type { ExpensePart } from '@yallist/domain';
import { and, asc, eq, inArray, type SQLWrapper } from 'drizzle-orm';

import { fail } from '../access';
import {
  expenseItems,
  expensePartShares,
  expenseParts,
  expenseShares,
  expenses,
  items,
  shoppingRuns,
} from '../db/schema';
import type { Executor } from '../db/tx';

/**
 * The expense, the members it is split between, the buy items it covers, and its parts with
 * their own members (see expense_parts).
 */
export async function insertExpense(
  tx: Executor,
  values: typeof expenses.$inferInsert,
  shares: string[],
  itemIds: string[] = [],
  parts: ExpensePart[] = [],
) {
  const [expense] = await tx.insert(expenses).values(values).returning();
  await insertShares(tx, expense!.id, shares);
  if (itemIds.length > 0) {
    await tx
      .insert(expenseItems)
      .values(itemIds.map((itemId) => ({ expenseId: expense!.id, itemId })));
  }
  await insertParts(tx, expense!.id, parts);
  return expense!;
}

const insertShares = (tx: Executor, expenseId: string, shares: string[]) =>
  tx.insert(expenseShares).values(shares.map((userId) => ({ expenseId, userId })));

async function insertParts(tx: Executor, expenseId: string, parts: ExpensePart[]) {
  for (const [position, part] of parts.entries()) {
    const [row] = await tx
      .insert(expenseParts)
      .values({ expenseId, position, label: part.label, amountAgorot: part.amountAgorot })
      .returning({ id: expenseParts.id });
    await tx
      .insert(expensePartShares)
      .values(part.shares.map((userId) => ({ partId: row!.id, userId })));
  }
}

/**
 * Changes the expense in place: its fields, and who shares it and its parts when given (they
 * replace what it had). Its receipt and the items it covers stay.
 */
export async function updateExpense(
  tx: Executor,
  expenseId: string,
  values: Pick<Partial<typeof expenses.$inferInsert>, 'description' | 'amountAgorot' | 'paidBy'>,
  { shares, parts }: { shares?: string[]; parts?: ExpensePart[] } = {},
) {
  // Only shares or parts changing: the row stays as it is.
  const changed = Object.values(values).some((v) => v !== undefined);
  const [expense] = changed
    ? await tx.update(expenses).set(values).where(eq(expenses.id, expenseId)).returning()
    : await tx.select().from(expenses).where(eq(expenses.id, expenseId));
  if (shares) {
    await tx.delete(expenseShares).where(eq(expenseShares.expenseId, expenseId));
    await insertShares(tx, expenseId, shares);
  }
  if (parts) {
    await deleteParts(tx, [expenseId]);
    await insertParts(tx, expenseId, parts);
  }
  return expense!;
}

/**
 * Who shares the expense, the items it covers (`itemIds` without deleted ones, `itemCount` with
 * them) and its parts with their own members: everything `toExpense` needs besides the row.
 */
export async function expenseSplit(tx: Executor, expenseId: string) {
  const [shareRows, itemRows, partRows] = await Promise.all([
    tx
      .select({ userId: expenseShares.userId })
      .from(expenseShares)
      .where(eq(expenseShares.expenseId, expenseId)),
    tx
      .select({ itemId: expenseItems.itemId, deletedAt: items.deletedAt })
      .from(expenseItems)
      .innerJoin(items, eq(items.id, expenseItems.itemId))
      .where(eq(expenseItems.expenseId, expenseId)),
    tx
      .select()
      .from(expenseParts)
      .where(eq(expenseParts.expenseId, expenseId))
      .orderBy(asc(expenseParts.position)),
  ]);
  const partShares =
    partRows.length === 0
      ? []
      : await tx
          .select()
          .from(expensePartShares)
          .where(
            inArray(
              expensePartShares.partId,
              partRows.map((p) => p.id),
            ),
          );
  return {
    shares: shareRows.map((s) => s.userId),
    itemIds: itemRows.filter((i) => i.deletedAt === null).map((i) => i.itemId),
    itemCount: itemRows.length,
    parts: partRows.map((p): ExpensePart => ({
      label: p.label,
      amountAgorot: p.amountAgorot,
      shares: partShares.filter((s) => s.partId === p.id).map((s) => s.userId),
    })),
  };
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
  await deleteParts(tx, [expenseId]);
  await tx.delete(expenseShares).where(eq(expenseShares.expenseId, expenseId));
  await tx.delete(expenseItems).where(eq(expenseItems.expenseId, expenseId));
  await tx
    .update(shoppingRuns)
    .set({ expenseId: null })
    .where(eq(shoppingRuns.expenseId, expenseId));
  await tx.delete(expenses).where(eq(expenses.id, expenseId));
}

/** The parts of these expenses and who shares them; the expenses are deleted next. */
export async function deleteParts(tx: Executor, expenseIds: string[] | SQLWrapper) {
  const parts = tx
    .select({ id: expenseParts.id })
    .from(expenseParts)
    .where(inArray(expenseParts.expenseId, expenseIds));
  await tx.delete(expensePartShares).where(inArray(expensePartShares.partId, parts));
  await tx.delete(expenseParts).where(inArray(expenseParts.expenseId, expenseIds));
}
