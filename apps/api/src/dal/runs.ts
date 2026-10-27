import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';

import { fail } from '../access';
import { claims, items, shoppingRuns } from '../db/schema';
import type { Executor, Tx } from '../db/tx';

type Run = typeof shoppingRuns.$inferSelect;

export const toRun = (run: Run) => ({
  id: run.id,
  shopperId: run.shopperId,
  startedAt: run.startedAt.toISOString(),
});

/** The shopper's active run in the trip, if any. */
export async function findActiveRun(tx: Executor, tripId: string, shopperId: string) {
  const [run] = await tx
    .select()
    .from(shoppingRuns)
    .where(
      and(
        eq(shoppingRuns.tripId, tripId),
        eq(shoppingRuns.shopperId, shopperId),
        eq(shoppingRuns.status, 'active'),
      ),
    );
  return run;
}

export async function insertRun(tx: Executor, tripId: string, shopperId: string) {
  const [run] = await tx
    .insert(shoppingRuns)
    .values({ tripId, shopperId, status: 'active', active: true })
    .returning();
  return run!;
}

/**
 * The trip's run, locked, for a change only its shopper may make while it is active: 404, 403 or
 * 409 otherwise.
 */
export async function lockActiveRun(tx: Tx, tripId: string, runId: string, shopperId: string) {
  const [run] = await tx
    .select()
    .from(shoppingRuns)
    .where(and(eq(shoppingRuns.id, runId), eq(shoppingRuns.tripId, tripId)))
    .for('update');
  if (!run) throw fail(404, 'Shopping run not found');
  if (run.shopperId !== shopperId) throw fail(403, 'Only the shopper');
  if (run.status !== 'active') throw fail(409, 'The shopping run is over');
  return run;
}

/** The run's claims on items still on the list, in list order. */
export const runClaims = (tx: Executor, runId: string) =>
  tx
    .select({ itemId: claims.itemId, inCart: isNotNull(claims.inCartAt).mapWith(Boolean) })
    .from(claims)
    .innerJoin(items, eq(items.id, claims.itemId))
    .where(and(eq(claims.runId, runId), isNull(items.deletedAt)))
    .orderBy(asc(items.position));

/** Claims the whole item for the run's shopper. */
export const claimForRun = (tx: Executor, run: Run, item: { id: string; quantityNeeded: number }) =>
  tx.insert(claims).values({
    itemId: item.id,
    userId: run.shopperId,
    quantity: item.quantityNeeded,
    runId: run.id,
  });

export const setInCart = (tx: Executor, itemId: string, userId: string, inCart: boolean) =>
  tx
    .update(claims)
    .set({ inCartAt: inCart ? new Date() : null })
    .where(and(eq(claims.itemId, itemId), eq(claims.userId, userId)));

/**
 * Ends the run. What it bought (`done`) stays claimed by the shopper, out of the cart; everything
 * else goes back to the list.
 */
export async function endRun(
  tx: Executor,
  runId: string,
  end: { status: 'done'; expenseId: string } | { status: 'cancelled' },
) {
  const unbought =
    end.status === 'done'
      ? and(eq(claims.runId, runId), isNull(claims.inCartAt))
      : eq(claims.runId, runId);
  await tx.delete(claims).where(unbought);
  if (end.status === 'done') {
    await tx.update(claims).set({ inCartAt: null }).where(eq(claims.runId, runId));
  }
  await tx
    .update(shoppingRuns)
    .set({ ...end, active: null, finishedAt: new Date() })
    .where(eq(shoppingRuns.id, runId));
}

/** Cancels the member's active runs in the trip (they're being removed from it). */
export async function cancelMemberRuns(tx: Executor, tripId: string, userId: string) {
  const run = await findActiveRun(tx, tripId, userId);
  if (run) await endRun(tx, run.id, { status: 'cancelled' });
}
