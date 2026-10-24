import { randomBytes } from 'node:crypto';

import { activeMemberIds, claimsFor, isDone } from '@yallist/domain';
import { and, count, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { displayNameOf, fail, lockTrip, logActivity, requireMember, validate } from '../access';
import { requireUser, type Auth } from '../auth';
import type { Db } from '../db/client';
import {
  claims,
  items,
  ROLES,
  TEMPLATE_IDS,
  templateItems,
  tripMembers,
  trips,
  TRIP_STATUSES,
} from '../db/schema';
import { transact, type Tx } from '../db/tx';
import { loadTrips, settleUp, toTrip } from '../trip-data';

/** 128 bits from a CSPRNG, URL-safe (SPEC §5): the invite link is a bearer capability. */
export const newInviteToken = () => randomBytes(16).toString('base64url');

const date = z.iso.date();
const tripFields = {
  name: z.string().trim().min(1).max(80),
  startsOn: date,
  endsOn: date,
  placeText: z.string().trim().max(120).nullable(),
  requireApproval: z.boolean(),
};
const datesInOrder = (t: { startsOn?: string; endsOn?: string }) =>
  !t.startsOn || !t.endsOn || t.startsOn <= t.endsOn;
const datesMessage = { message: 'endsOn is before startsOn', path: ['endsOn'] };

const createTrip = z
  .object({
    ...tripFields,
    placeText: tripFields.placeText.optional(),
    requireApproval: tripFields.requireApproval.optional(),
    template: z.enum(TEMPLATE_IDS),
  })
  .refine(datesInOrder, datesMessage);
const updateTrip = z
  .object({ ...tripFields, status: z.enum(TRIP_STATUSES) })
  .partial()
  .refine(datesInOrder, datesMessage);

const tripParam = z.object({ tripId: z.uuid() });
const memberParam = z.object({ tripId: z.uuid(), userId: z.uuid() });

/** The target member, locked; the caller must be an organizer. */
async function organizerAction(tx: Tx, tripId: string, callerId: string, userId: string) {
  // Lock the trip first: organizer changes then run one at a time, so two organizers can't
  // demote or remove each other at once and leave the trip without one.
  await lockTrip(tx, tripId);
  await requireMember(tx, tripId, callerId, { organizer: true, lock: true });
  const [target] = await tx
    .select()
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)))
    .for('update');
  if (!target) throw fail(404, 'Member not found');
  return target;
}

async function assertNotLastOrganizer(tx: Tx, member: Member) {
  if (member.role !== 'organizer' || member.status !== 'active') return;
  const [{ organizers } = { organizers: 0 }] = await tx
    .select({ organizers: count() })
    .from(tripMembers)
    .where(
      and(
        eq(tripMembers.tripId, member.tripId),
        eq(tripMembers.role, 'organizer'),
        eq(tripMembers.status, 'active'),
      ),
    );
  if (organizers <= 1) throw fail(409, 'A trip needs at least one organizer');
}

type Member = typeof tripMembers.$inferSelect;

const setMember = (tx: Tx, member: Member, values: Pick<Partial<Member>, 'role' | 'status'>) =>
  tx
    .update(tripMembers)
    .set(values)
    .where(and(eq(tripMembers.tripId, member.tripId), eq(tripMembers.userId, member.userId)));

/** Trips, their settings and invite link, and membership management. All need a session. */
export const tripRoutes = (auth: Auth, db: Db) =>
  new Hono()
    .use(requireUser(auth))

    // Create a trip from a template: the caller is its organizer.
    .post('/', validate('json', createTrip), async (c) => {
      const { template, ...input } = c.req.valid('json');
      const user = c.var.user;
      const data = await transact(db, async (tx) => {
        const [trip] = await tx
          .insert(trips)
          .values({ ...input, template, inviteToken: newInviteToken(), createdBy: user.id })
          .returning();
        const tripId = trip!.id;
        await tx.insert(tripMembers).values({
          tripId,
          userId: user.id,
          role: 'organizer',
          status: 'active',
          displayName: await displayNameOf(tx, user),
        });
        const seed = await tx
          .select()
          .from(templateItems)
          .where(eq(templateItems.template, template));
        if (seed.length > 0) {
          await tx
            .insert(items)
            .values(
              seed.map(({ template: _, ...item }) => ({ ...item, tripId, createdBy: user.id })),
            );
        }
        await logActivity(tx, tripId, user.id, 'trip_created', { template });
        return (await loadTrips(tx, [tripId]))[0]!;
      });
      return c.json(data, 201);
    })

    // My trips, with what the home screen shows for each.
    .get('/', async (c) => {
      const me = c.var.user.id;
      const all = await transact(db, async (tx) => {
        const mine = await tx
          .select({ tripId: tripMembers.tripId })
          .from(tripMembers)
          .where(and(eq(tripMembers.userId, me), eq(tripMembers.status, 'active')));
        return loadTrips(
          tx,
          mine.map((m) => m.tripId),
        );
      });
      const summaries = all
        .sort((a, b) => a.trip.startsOn.localeCompare(b.trip.startsOn))
        .map((d) => {
          const activeIds = activeMemberIds(d.members);
          return {
            trip: d.trip,
            members: d.members.filter((m) => m.status === 'active'),
            itemCount: d.items.length,
            doneCount: d.items.filter((i) => isDone(i, d.claims, d.expenses, activeIds)).length,
            mine: d.items
              .filter((i) => claimsFor(i.id, d.claims).some((cl) => cl.userId === me))
              .map((i) => i.name),
            /** Suggested transfers I'm part of: still to pay or to receive. */
            transfers: settleUp(d).transfers.filter((t) => t.from === me || t.to === me),
          };
        });
      return c.json({ trips: summaries });
    })

    // Everything the trip screens need, with balances. Active members only.
    .get('/:tripId', validate('param', tripParam), async (c) => {
      const { tripId } = c.req.valid('param');
      const data = await transact(db, async (tx) => {
        await requireMember(tx, tripId, c.var.user.id);
        return (await loadTrips(tx, [tripId]))[0]!;
      });
      return c.json({ ...data, ...settleUp(data) });
    })

    .patch('/:tripId', validate('param', tripParam), validate('json', updateTrip), async (c) => {
      const { tripId } = c.req.valid('param');
      const changes = c.req.valid('json');
      const trip = await transact(db, async (tx) => {
        const current = await lockTrip(tx, tripId);
        await requireMember(tx, tripId, c.var.user.id, { organizer: true, lock: true });
        if (!datesInOrder({ ...current, ...changes })) throw fail(400, datesMessage.message);
        const [updated] = await tx
          .update(trips)
          .set({ ...changes, updatedAt: new Date() })
          .where(eq(trips.id, tripId))
          .returning();
        await logActivity(tx, tripId, c.var.user.id, 'trip_updated', {
          fields: Object.keys(changes),
        });
        return updated!;
      });
      return c.json(toTrip(trip));
    })

    // A new invite link; the old one stops working at once.
    .post('/:tripId/invite/rotate', validate('param', tripParam), async (c) => {
      const { tripId } = c.req.valid('param');
      const inviteToken = newInviteToken();
      await transact(db, async (tx) => {
        await lockTrip(tx, tripId);
        await requireMember(tx, tripId, c.var.user.id, { organizer: true, lock: true });
        await tx
          .update(trips)
          .set({ inviteToken, updatedAt: new Date() })
          .where(eq(trips.id, tripId));
        await logActivity(tx, tripId, c.var.user.id, 'invite_rotated');
      });
      return c.json({ inviteToken });
    })

    .post('/:tripId/members/:userId/approve', validate('param', memberParam), async (c) => {
      const { tripId, userId } = c.req.valid('param');
      await transact(db, async (tx) => {
        const target = await organizerAction(tx, tripId, c.var.user.id, userId);
        if (target.status !== 'pending') throw fail(409, 'Not waiting for approval');
        await setMember(tx, target, { status: 'active' });
        await logActivity(tx, tripId, c.var.user.id, 'member_approved', { userId });
      });
      return c.json({ userId, status: 'active' as const });
    })

    .post('/:tripId/members/:userId/decline', validate('param', memberParam), async (c) => {
      const { tripId, userId } = c.req.valid('param');
      await transact(db, async (tx) => {
        const target = await organizerAction(tx, tripId, c.var.user.id, userId);
        if (target.status !== 'pending') throw fail(409, 'Not waiting for approval');
        await setMember(tx, target, { status: 'removed' });
        await logActivity(tx, tripId, c.var.user.id, 'member_declined', { userId });
      });
      return c.json({ userId, status: 'removed' as const });
    })

    // Removes an active member and drops their claims: what they took is missing again.
    .delete('/:tripId/members/:userId', validate('param', memberParam), async (c) => {
      const { tripId, userId } = c.req.valid('param');
      await transact(db, async (tx) => {
        const target = await organizerAction(tx, tripId, c.var.user.id, userId);
        if (target.status !== 'active') throw fail(409, 'Not an active member');
        await assertNotLastOrganizer(tx, target);
        await setMember(tx, target, { status: 'removed' });
        const tripItems = tx.select({ id: items.id }).from(items).where(eq(items.tripId, tripId));
        await tx
          .delete(claims)
          .where(and(eq(claims.userId, userId), inArray(claims.itemId, tripItems)));
        await logActivity(tx, tripId, c.var.user.id, 'member_removed', { userId });
      });
      return c.json({ userId, status: 'removed' as const });
    })

    .put(
      '/:tripId/members/:userId/role',
      validate('param', memberParam),
      validate('json', z.object({ role: z.enum(ROLES) })),
      async (c) => {
        const { tripId, userId } = c.req.valid('param');
        const { role } = c.req.valid('json');
        await transact(db, async (tx) => {
          const target = await organizerAction(tx, tripId, c.var.user.id, userId);
          if (target.status !== 'active') throw fail(409, 'Not an active member');
          if (role === 'member') await assertNotLastOrganizer(tx, target);
          await setMember(tx, target, { role });
          await logActivity(tx, tripId, c.var.user.id, 'member_role_set', { userId, role });
        });
        return c.json({ userId, role });
      },
    );
