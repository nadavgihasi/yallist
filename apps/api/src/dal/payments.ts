import { and, eq } from 'drizzle-orm';

import { fail } from '../access';
import { payments } from '../db/schema';
import type { Executor, Tx } from '../db/tx';

export async function insertPayment(tx: Executor, values: typeof payments.$inferInsert) {
  const [payment] = await tx.insert(payments).values(values).returning();
  return payment!;
}

export async function lockPayment(tx: Tx, tripId: string, paymentId: string) {
  const [payment] = await tx
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.tripId, tripId)))
    .for('update');
  if (!payment) throw fail(404, 'Payment not found');
  return payment;
}

export const confirmPayment = (tx: Executor, paymentId: string) =>
  tx
    .update(payments)
    .set({ status: 'confirmed', confirmedAt: new Date() })
    .where(eq(payments.id, paymentId));

export const deletePayment = (tx: Executor, paymentId: string) =>
  tx.delete(payments).where(eq(payments.id, paymentId));
