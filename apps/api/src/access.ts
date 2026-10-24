import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import type { ValidationTargets } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';

import type { User } from './auth';
import { activity, profiles, tripMembers, trips } from './db/schema';
import type { Tx } from './db/tx';

export const fail = (status: ContentfulStatusCode, message: string) =>
  new HTTPException(status, { message });

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
  const query = tx
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)));
  const [member] = await (lock ? query.for('update') : query);
  if (member?.status !== 'active') throw fail(404, 'Trip not found');
  if (organizer && member.role !== 'organizer') throw fail(403, 'Organizers only');
  return member;
}

/** Locks the trip row, serializing writes that must see every other one (organizer counts). */
export async function lockTrip(tx: Tx, tripId: string) {
  const [trip] = await tx.select().from(trips).where(eq(trips.id, tripId)).for('update');
  if (!trip) throw fail(404, 'Trip not found');
  return trip;
}

/** Records a change in the trip's activity feed, in the transaction that makes it. */
export async function logActivity(
  tx: Tx,
  tripId: string,
  actor: string,
  type: string,
  payload: Record<string, unknown> = {},
) {
  await tx.insert(activity).values({ tripId, actor, type, payload });
}

/** The caller's name as they set it in their profile. */
export async function displayNameOf(tx: Tx, user: User) {
  const [profile] = await tx
    .select({ displayName: profiles.displayName })
    .from(profiles)
    .where(eq(profiles.id, user.id));
  return profile?.displayName ?? user.name;
}

/** zValidator that fails with our `{ error }` 400, which keeps it out of the typed responses. */
export const validate = <T extends z.ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) =>
  zValidator(target, schema, (result) => {
    if (!result.success) throw fail(400, z.prettifyError(result.error));
  });
