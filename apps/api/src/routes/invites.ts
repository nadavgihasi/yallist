import { activeMemberIds, isDone } from '@yallist/domain';
import { Hono } from 'hono';
import { z } from 'zod';

import { fail, validate } from '../access';
import { requireUser, type Auth } from '../auth';
import { logActivity } from '../dal/activity';
import { findMember, insertMember } from '../dal/members';
import { displayNameOf } from '../dal/profiles';
import { loadTrips, tripByToken } from '../dal/trips';
import type { Db } from '../db/client';
import { transact } from '../db/tx';
import type { Publish } from '../realtime';

/** The signed-in caller's place in the trip, as the invite preview tells them. */
type Membership = { status: 'active' | 'pending'; tripId: string } | { status: 'none' };

const tokenParam = z.object({ token: z.string().min(1).max(64) });

/** The invite link: a bearer capability for joining one trip (SPEC §5). */
export const inviteRoutes = (auth: Auth, db: Db, notify: Publish) =>
  new Hono()
    // Public, for the join page and link previews: only what a stranger holding the link may see.
    // A signed-in caller also learns their own membership, so a member isn't asked to join again.
    .get('/:token', validate('param', tokenParam), async (c) => {
      const { token } = c.req.valid('param');
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      const data = await transact(db, async (tx) => {
        const trip = await tripByToken(tx, token);
        return (await loadTrips(tx, [trip.id]))[0]!;
      });
      const activeIds = activeMemberIds(data.members);
      const status = session && data.members.find((m) => m.userId === session.user.id)?.status;
      // A removed member gets `none`: joining says so (403).
      const membership: Membership | undefined = !session
        ? undefined
        : status === 'active' || status === 'pending'
          ? { status, tripId: data.trip.id }
          : { status: 'none' };
      const missing = data.items.filter((i) => !isDone(i, data.claims, data.expenses, activeIds));
      return c.json({
        name: data.trip.name,
        startsOn: data.trip.startsOn,
        endsOn: data.trip.endsOn,
        cover: data.trip.cover,
        memberCount: activeIds.length,
        missingCount: missing.length,
        missingItems: missing.slice(0, 6).map((i) => i.name),
        // Only for a signed-in caller; a stranger learns nothing about who's in.
        ...(membership && { membership }),
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
          const existing = await findMember(tx, trip.id, user.id);
          if (existing?.status === 'removed') throw fail(403, 'Removed from this trip');
          if (existing) return { tripId: trip.id, status: existing.status };

          const status = trip.requireApproval ? 'pending' : 'active';
          await insertMember(tx, {
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
        await notify(result.tripId);
        return c.json(result);
      },
    );
