import { activeMemberIds, isDone } from '@yallist/domain';
import { Hono } from 'hono';
import { z } from 'zod';

import { fail, validate } from '../access';
import { requireUser, type Auth } from '../auth';
import { leftOnTheirOwn, logActivity } from '../dal/activity';
import { findMember, insertMember, setMember } from '../dal/members';
import { displayNameOf } from '../dal/profiles';
import { loadTrips, tripByToken } from '../dal/trips';
import type { Db } from '../db/client';
import { transact } from '../db/tx';
import type { Publish } from '../realtime';

/** The signed-in caller's place in the trip, as the invite preview tells them. */
type Membership = { status: 'active' | 'pending'; tripId: string } | { status: 'none' };

/** How many members the invite preview names; `memberCount` counts them all. */
const PREVIEW_MEMBERS = 8;

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
      // A removed member, or one who left, gets `none`: joining again says whether they may (403).
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
        // Who's in, so a joiner sees whose trip it is: display names and avatar colors only (no
        // ids, no photos, which only trip-mates see), the first few to join.
        members: data.members
          .filter((m) => m.status === 'active')
          .slice(0, PREVIEW_MEMBERS)
          .map((m) => ({ name: m.displayName, color: m.color })),
        // Only for a signed-in caller: their own place in the trip.
        ...(membership && { membership }),
      });
    })

    // Joins the trip, or asks to when it requires approval. Joining again changes nothing. A member
    // who left can join again, as a plain member; one an organizer removed or declined can't.
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
          const existing = await findMember(tx, trip.id, user.id, { lock: true });
          if (existing?.status === 'removed' && !(await leftOnTheirOwn(tx, trip.id, user.id)))
            throw fail(403, 'Removed from this trip');
          if (existing && existing.status !== 'removed')
            return { tripId: trip.id, status: existing.status };

          const status = trip.requireApproval ? 'pending' : 'active';
          if (existing) await setMember(tx, existing, { role: 'member', status });
          else
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
