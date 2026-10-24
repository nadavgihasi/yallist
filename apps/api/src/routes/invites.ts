import { activeMemberIds, isDone } from '@yallist/domain';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { displayNameOf, fail, logActivity, validate } from '../access';
import { requireUser, type Auth } from '../auth';
import type { Db } from '../db/client';
import { tripMembers, trips } from '../db/schema';
import { transact, type Tx } from '../db/tx';
import { loadTrips } from '../trip-data';

const tokenParam = z.object({ token: z.string().min(1).max(64) });

async function tripByToken(tx: Tx, token: string) {
  const [trip] = await tx.select().from(trips).where(eq(trips.inviteToken, token));
  // Unknown and rotated tokens look the same.
  if (!trip) throw fail(404, 'Invite not found');
  return trip;
}

/** The invite link: a bearer capability for joining one trip (SPEC §5). */
export const inviteRoutes = (auth: Auth, db: Db) =>
  new Hono()
    // Public, for the join page and link previews: only what a stranger holding the link may see.
    .get('/:token', validate('param', tokenParam), async (c) => {
      const { token } = c.req.valid('param');
      const data = await transact(db, async (tx) => {
        const trip = await tripByToken(tx, token);
        return (await loadTrips(tx, [trip.id]))[0]!;
      });
      const activeIds = activeMemberIds(data.members);
      const missing = data.items.filter((i) => !isDone(i, data.claims, data.expenses, activeIds));
      return c.json({
        name: data.trip.name,
        startsOn: data.trip.startsOn,
        endsOn: data.trip.endsOn,
        memberCount: activeIds.length,
        missingCount: missing.length,
        missingItems: missing.slice(0, 6).map((i) => i.name),
      });
    })

    // Joins the trip, or asks to when it requires approval. Joining again changes nothing.
    .post(
      '/:token/join',
      requireUser(auth),
      validate('param', tokenParam),
      validate('json', z.object({ displayName: z.string().trim().min(1).max(50).optional() })),
      async (c) => {
        const { token } = c.req.valid('param');
        const { displayName } = c.req.valid('json');
        const user = c.var.user;
        const result = await transact(db, async (tx) => {
          const trip = await tripByToken(tx, token);
          const [existing] = await tx
            .select()
            .from(tripMembers)
            .where(and(eq(tripMembers.tripId, trip.id), eq(tripMembers.userId, user.id)));
          if (existing?.status === 'removed') throw fail(403, 'Removed from this trip');
          if (existing) return { tripId: trip.id, status: existing.status };

          const status = trip.requireApproval ? 'pending' : 'active';
          await tx.insert(tripMembers).values({
            tripId: trip.id,
            userId: user.id,
            role: 'member',
            status,
            displayName: displayName ?? (await displayNameOf(tx, user)),
          });
          await logActivity(
            tx,
            trip.id,
            user.id,
            status === 'active' ? 'member_joined' : 'member_requested',
          );
          return { tripId: trip.id, status };
        });
        return c.json(result);
      },
    );
