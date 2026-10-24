import { and, count, eq } from 'drizzle-orm';

import { fail } from '../access';
import { tripMembers } from '../db/schema';
import type { Executor, Tx } from '../db/tx';

type Member = typeof tripMembers.$inferSelect;

/** The user's membership of the trip in any status. Writes pass `lock`. */
export async function findMember(
  tx: Executor,
  tripId: string,
  userId: string,
  { lock = false } = {},
) {
  const query = tx
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)));
  const [member] = await (lock ? query.for('update') : query);
  return member;
}

/**
 * The caller's active membership of the trip, or 404 (a non-member can't tell whether the trip
 * exists). With `organizer`, a plain member gets 403. Writes pass `lock`, so a concurrent change
 * to the caller's membership (say, being removed) conflicts with the write instead of racing it.
 */
export async function requireMember(
  tx: Tx,
  tripId: string,
  userId: string,
  { organizer = false, lock = false } = {},
) {
  const member = await findMember(tx, tripId, userId, { lock });
  if (member?.status !== 'active') throw fail(404, 'Trip not found');
  if (organizer && member.role !== 'organizer') throw fail(403, 'Organizers only');
  return member;
}

/** Another member of the trip, in any status, locked. */
export async function lockMember(tx: Tx, tripId: string, userId: string) {
  const member = await findMember(tx, tripId, userId, { lock: true });
  if (!member) throw fail(404, 'Member not found');
  return member;
}

export const insertMember = (tx: Executor, values: typeof tripMembers.$inferInsert) =>
  tx.insert(tripMembers).values(values);

export const setMember = (
  tx: Executor,
  member: Member,
  values: Pick<Partial<Member>, 'role' | 'status'>,
) =>
  tx
    .update(tripMembers)
    .set(values)
    .where(and(eq(tripMembers.tripId, member.tripId), eq(tripMembers.userId, member.userId)));

export async function countActiveOrganizers(tx: Executor, tripId: string) {
  const [{ organizers } = { organizers: 0 }] = await tx
    .select({ organizers: count() })
    .from(tripMembers)
    .where(
      and(
        eq(tripMembers.tripId, tripId),
        eq(tripMembers.role, 'organizer'),
        eq(tripMembers.status, 'active'),
      ),
    );
  return organizers;
}

/** The trips the user is an active member of. */
export async function activeTripIds(tx: Executor, userId: string) {
  const rows = await tx
    .select({ tripId: tripMembers.tripId })
    .from(tripMembers)
    .where(and(eq(tripMembers.userId, userId), eq(tripMembers.status, 'active')));
  return rows.map((r) => r.tripId);
}

/** The trip's active members' user ids. */
export async function activeUserIds(tx: Executor, tripId: string) {
  const rows = await tx
    .select({ userId: tripMembers.userId })
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.status, 'active')));
  return new Set(rows.map((r) => r.userId));
}
