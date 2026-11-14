import { COVER_IDS, TEMPLATES, type CoverId, type TemplateId } from '@yallist/domain';
import { testClient } from 'hono/testing';
import type { Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAuth, type AuthConfig } from '../auth';
import { createDb } from '../db/client';
import { migrate } from '../db/migrate';
import { createTestDatabase, DATABASE_URL, signInAsGuest, testApp } from '../test-db';

describe.skipIf(!DATABASE_URL)('trips, invites, items and claims', () => {
  let sql: Sql;
  let drop: () => Promise<void>;
  let app: ReturnType<typeof testApp>;
  let client: ReturnType<typeof testClient<ReturnType<typeof testApp>>>;

  beforeAll(async () => {
    ({ sql, drop } = await createTestDatabase());
    await migrate(sql, { dsql: false });
    app = testApp(createDb(sql));
    client = testClient(app);
  });

  afterAll(() => drop());

  type Guest = Awaited<ReturnType<typeof signInAsGuest>>;
  const guest = (name: string) => signInAsGuest(app, name);
  const as = (user: Guest) => ({ headers: user.headers });

  async function createTrip(
    user: Guest,
    extra: { requireApproval?: boolean; template?: TemplateId; cover?: CoverId } = {},
  ) {
    const res = await client.trips.$post(
      {
        json: {
          name: 'צפון',
          startsOn: '2026-11-05',
          endsOn: '2026-11-07',
          template: 'camp',
          ...extra,
        },
      },
      as(user),
    );
    expect(res.status).toBe(201);
    return res.json();
  }

  const detail = (user: Guest, tripId: string) =>
    client.trips[':tripId'].$get({ param: { tripId } }, as(user));
  const join = (user: Guest, token: string) =>
    client.invites[':token'].join.$post({ param: { token }, json: {} }, as(user));
  const claim = (user: Guest, tripId: string, itemId: string, quantity: number) =>
    client.trips[':tripId'].items[':itemId'].claim.$put(
      { param: { tripId, itemId }, json: { quantity } },
      as(user),
    );
  const activityTypes = async (tripId: string) =>
    (
      await sql<{ type: string }[]>`
        select type from activity where trip_id = ${tripId} order by created_at`
    ).map((r) => r.type);

  /** A trip with an organizer and one active member. */
  async function tripWithMember() {
    const organizer = await guest('organizer');
    const member = await guest('member');
    const data = await createTrip(organizer);
    expect((await join(member, data.inviteToken)).status).toBe(200);
    return { organizer, member, data };
  }

  describe('create and read', () => {
    it('creates a trip from its template with the creator as organizer', async () => {
      const dana = await guest('דנה');
      const data = await createTrip(dana);

      expect(data.trip).toMatchObject({
        name: 'צפון',
        template: 'camp',
        cover: 'camp',
        status: 'planning',
      });
      expect(data.inviteToken).toMatch(/^[\w-]{22}$/);
      expect(data.members).toEqual([
        expect.objectContaining({ userId: dana.id, role: 'organizer', status: 'active' }),
      ]);
      expect(data.items).toHaveLength(TEMPLATES.camp.length);
      // The template's categories, in order, each holding its items.
      const names = (list: string) =>
        data.categories.filter((cat) => cat.list === list).map((cat) => cat.name);
      const templateNames = (list: string) => [
        ...new Set(TEMPLATES.camp.filter((t) => t.list === list).map((t) => t.category)),
      ];
      expect(names('bring')).toEqual(templateNames('bring'));
      expect(names('buy')).toEqual(templateNames('buy'));
      const first = data.categories[0]!;
      expect(data.items.filter((i) => i.categoryId === first.id).map((i) => i.name)).toEqual(
        TEMPLATES.camp.filter((t) => t.category === first.name).map((t) => t.name),
      );
      expect(await activityTypes(data.trip.id)).toEqual(['trip_created']);
    });

    it('lists my trips with item counts and what I took', async () => {
      const { organizer, member, data } = await tripWithMember();
      const single = data.items.find((i) => i.kind === 'single')!;
      expect((await claim(member, data.trip.id, single.id, 1)).status).toBe(200);

      const res = await client.trips.$get({}, as(member));
      expect(res.status).toBe(200);
      const { trips } = await res.json();
      expect(trips).toEqual([
        expect.objectContaining({
          itemCount: data.items.length,
          doneCount: 1,
          mine: [single.name],
          missingNames: data.items
            .filter((i) => i.id !== single.id)
            .slice(0, 3)
            .map((i) => i.name),
        }),
      ]);
      expect(trips[0]!.members.map((m) => m.userId)).toEqual([organizer.id, member.id]);
    });

    it('hides a trip from non-members and pending members', async () => {
      const organizer = await guest('organizer');
      const data = await createTrip(organizer, { requireApproval: true });
      const stranger = await guest('stranger');
      const pending = await guest('pending');
      expect(await (await join(pending, data.inviteToken)).json()).toMatchObject({
        status: 'pending',
      });

      expect((await detail(stranger, data.trip.id)).status).toBe(404);
      expect((await detail(pending, data.trip.id)).status).toBe(404);
      expect((await client.trips.$get({}, as(pending))).status).toBe(200);
      expect((await (await client.trips.$get({}, as(pending))).json()).trips).toEqual([]);
      const anonymous = await app.request(`/trips/${data.trip.id}`);
      expect(anonymous.status).toBe(401);
    });

    it('lets only organizers change the trip', async () => {
      const { organizer, member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const patch = (user: Guest, json: { name?: string; endsOn?: string }) =>
        client.trips[':tripId'].$patch({ param: { tripId }, json }, as(user));

      expect((await patch(member, { name: 'x' })).status).toBe(403);
      expect((await patch(organizer, { endsOn: '2026-11-01' })).status).toBe(400);
      const res = await patch(organizer, { name: 'דרום' });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ name: 'דרום', endsOn: '2026-11-07' });
    });

    it("covers a trip with its template's cover unless one is picked", async () => {
      const dana = await guest('דנה');
      expect((await createTrip(dana, { template: 'grill' })).trip.cover).toBe('picnic');
      expect((await createTrip(dana, { template: 'blank' })).trip.cover).toBe('trail');
      const picked = await createTrip(dana, { template: 'camp', cover: 'desert' });
      expect(picked.trip.cover).toBe('desert');
      expect((await (await detail(dana, picked.trip.id)).json()).trip.cover).toBe('desert');
    });

    it('changes the cover, and only to one of the covers', async () => {
      const { organizer, member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const patch = (user: Guest, cover: string) =>
        client.trips[':tripId'].$patch(
          { param: { tripId }, json: { cover: cover as CoverId } },
          as(user),
        );

      expect((await patch(member, 'city')).status).toBe(403);
      expect((await patch(organizer, 'mars')).status).toBe(400);
      const res = await patch(organizer, 'city');
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ cover: 'city', template: 'camp' });
      const { trips } = await (await client.trips.$get({}, as(member))).json();
      expect(trips[0]!.trip.cover).toBe('city');

      const bad = await client.trips.$post(
        {
          json: {
            name: 'x',
            startsOn: '2026-11-05',
            endsOn: '2026-11-05',
            template: 'camp',
            cover: 'mars' as CoverId,
          },
        },
        as(organizer),
      );
      expect(bad.status).toBe(400);
    });

    it('saves every cover, the newer ones included', async () => {
      const { organizer, data } = await tripWithMember();
      for (const cover of COVER_IDS) {
        const res = await client.trips[':tripId'].$patch(
          { param: { tripId: data.trip.id }, json: { cover } },
          as(organizer),
        );
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ cover });
      }
    });

    it('sets the meetup place, its point and the photo album: organizers only, allowed links only', async () => {
      const { organizer, member, data } = await tripWithMember();
      const tripId = data.trip.id;
      type Links = {
        meetupText?: string | null;
        meetupPoint?: { lat: number; lng: number } | null;
        albumUrl?: string | null;
      };
      const patch = (user: Guest, json: Links) =>
        client.trips[':tripId'].$patch({ param: { tripId }, json }, as(user));
      const album = 'https://photos.app.goo.gl/AbC123';

      expect((await patch(member, { meetupText: 'חניון עין גדי' })).status).toBe(403);
      for (const meetupText of [
        'https://example.com/place',
        'http://waze.com/ul?q=x',
        '  ',
        'x'.repeat(301),
      ]) {
        expect((await patch(organizer, { meetupText })).status).toBe(400);
      }
      for (const albumUrl of [
        'http://photos.app.goo.gl/AbC123',
        'https://photos.google.com.evil.example/x',
        'https://drive.google.com/x',
        `${album}/${'x'.repeat(300)}`,
      ]) {
        expect((await patch(organizer, { albumUrl })).status).toBe(400);
      }
      for (const meetupPoint of [
        { lat: 91, lng: 35 },
        { lat: 31, lng: -181 },
        { lat: 31, lng: 35, zoom: 3 } as { lat: number; lng: number },
      ]) {
        expect((await patch(organizer, { meetupPoint })).status).toBe(400);
      }

      const res = await patch(organizer, { meetupText: ' חניון עין גדי ', albumUrl: album });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ meetupText: 'חניון עין גדי', albumUrl: album });
      const link = 'https://maps.app.goo.gl/AbC123';
      expect((await patch(organizer, { meetupText: link })).status).toBe(200);
      const meetupPoint = { lat: 31.461823, lng: 35.3881 };
      expect((await patch(organizer, { meetupPoint })).status).toBe(200);
      // Every member sees them.
      expect((await (await detail(member, tripId)).json()).trip).toMatchObject({
        meetupText: link,
        meetupPoint,
        albumUrl: album,
      });
      expect(await activityTypes(tripId)).toContain('trip_updated');

      const cleared = { meetupText: null, meetupPoint: null, albumUrl: null };
      expect((await patch(organizer, cleared)).status).toBe(200);
      const { trip } = await (await detail(member, tripId)).json();
      expect(trip.meetupText).toBeUndefined();
      expect(trip.meetupPoint).toBeUndefined();
      expect(trip.albumUrl).toBeUndefined();
    });
  });

  describe('invites', () => {
    it('previews a trip by token without signing in, showing only the basics', async () => {
      const { data } = await tripWithMember();
      const res = await client.invites[':token'].$get({ param: { token: data.inviteToken } });
      expect(res.status).toBe(200);
      const preview = await res.json();
      expect(Object.keys(preview).sort()).toEqual([
        'cover',
        'endsOn',
        'memberCount',
        'members',
        'missingCount',
        'missingItems',
        'name',
        'startsOn',
      ]);
      expect(preview).toMatchObject({
        cover: 'camp',
        memberCount: 2,
        missingCount: data.items.length,
      });
      expect(preview.missingItems).toEqual(data.items.slice(0, 6).map((i) => i.name));
    });

    it("names who's in to anyone with the link: display names and colors, nothing else", async () => {
      const organizer = await guest('organizer');
      const data = await createTrip(organizer, { requireApproval: true });
      const [member, waiting, removed, left] = [
        await guest('member'),
        await guest('waiting'),
        await guest('removed'),
        await guest('left'),
      ];
      for (const user of [member, waiting, removed, left]) await join(user, data.inviteToken);
      const tripId = data.trip.id;
      const decide = (user: Guest, action: 'approve' | 'decline') =>
        client.trips[':tripId'].members[':userId'][action].$post(
          { param: { tripId, userId: user.id } },
          as(organizer),
        );
      expect((await decide(member, 'approve')).status).toBe(200);
      expect((await decide(removed, 'decline')).status).toBe(200);
      // Was in, then left.
      expect((await decide(left, 'approve')).status).toBe(200);
      expect(
        (await client.trips[':tripId'].leave.$post({ param: { tripId } }, as(left))).status,
      ).toBe(200);

      const res = await client.invites[':token'].$get({ param: { token: data.inviteToken } });
      const { members, memberCount } = await res.json();
      // Active members only, in joining order; not who is waiting, was turned away or left.
      expect(members.map((m) => m.name)).toEqual(['organizer', 'member']);
      expect(memberCount).toBe(2);
      for (const m of members) {
        expect(Object.keys(m).sort()).toEqual(['color', 'name']);
        expect(m.color).toMatch(/^#/);
      }
    });

    it('names at most 8 members, and counts them all', async () => {
      const organizer = await guest('organizer');
      const data = await createTrip(organizer);
      for (let i = 1; i <= 9; i++) await join(await guest(`m${i}`), data.inviteToken);
      const res = await client.invites[':token'].$get({ param: { token: data.inviteToken } });
      const { members, memberCount } = await res.json();
      expect(members).toHaveLength(8);
      expect(memberCount).toBe(10);
    });

    it("tells a signed-in caller their own membership, and a stranger nobody's", async () => {
      const organizer = await guest('organizer');
      const data = await createTrip(organizer, { requireApproval: true });
      const [waiting, stranger, declined] = [
        await guest('waiting'),
        await guest('stranger'),
        await guest('declined'),
      ];
      await join(waiting, data.inviteToken);
      await join(declined, data.inviteToken);
      const decline = client.trips[':tripId'].members[':userId'].decline.$post(
        { param: { tripId: data.trip.id, userId: declined.id } },
        as(organizer),
      );
      expect((await decline).status).toBe(200);

      const membership = async (user?: Guest) => {
        const res = await client.invites[':token'].$get(
          { param: { token: data.inviteToken } },
          user && as(user),
        );
        return (await res.json()).membership;
      };
      const tripId = data.trip.id;
      expect(await membership(organizer)).toEqual({ status: 'active', tripId });
      expect(await membership(waiting)).toEqual({ status: 'pending', tripId });
      expect(await membership(stranger)).toEqual({ status: 'none' });
      expect(await membership(declined)).toEqual({ status: 'none' });
      expect(await membership()).toBeUndefined();
    });

    it('joins once, however many times the link is opened', async () => {
      const { member, data } = await tripWithMember();
      const again = await join(member, data.inviteToken);
      expect(await again.json()).toEqual({ tripId: data.trip.id, status: 'active' });
      const members = await (await detail(member, data.trip.id)).json();
      expect(members.members).toHaveLength(2);
      expect(await activityTypes(data.trip.id)).toEqual(['trip_created', 'member_joined']);
    });

    it('rejects a rotated token, and only organizers rotate', async () => {
      const { organizer, member, data } = await tripWithMember();
      const rotate = (user: Guest) =>
        client.trips[':tripId'].invite.rotate.$post({ param: { tripId: data.trip.id } }, as(user));
      expect((await rotate(member)).status).toBe(403);

      const res = await rotate(organizer);
      expect(res.status).toBe(200);
      const { inviteToken } = await res.json();
      expect(inviteToken).not.toBe(data.inviteToken);

      const late = await guest('late');
      const old = data.inviteToken;
      expect((await client.invites[':token'].$get({ param: { token: old } })).status).toBe(404);
      expect((await join(late, old)).status).toBe(404);
      expect((await join(late, inviteToken)).status).toBe(200);
    });
  });

  describe('members', () => {
    const memberPath = (tripId: string, userId: string) => ({ param: { tripId, userId } });

    it('approves and declines join requests', async () => {
      const organizer = await guest('organizer');
      const data = await createTrip(organizer, { requireApproval: true });
      const [yes, no] = [await guest('yes'), await guest('no')];
      await join(yes, data.inviteToken);
      await join(no, data.inviteToken);
      const members = client.trips[':tripId'].members[':userId'];

      expect((await members.approve.$post(memberPath(data.trip.id, yes.id), as(yes))).status).toBe(
        404,
      );
      expect(
        (await members.approve.$post(memberPath(data.trip.id, yes.id), as(organizer))).status,
      ).toBe(200);
      expect(
        (await members.decline.$post(memberPath(data.trip.id, no.id), as(organizer))).status,
      ).toBe(200);

      expect((await detail(yes, data.trip.id)).status).toBe(200);
      expect((await detail(no, data.trip.id)).status).toBe(404);
      expect((await join(no, data.inviteToken)).status).toBe(403);
    });

    it('never removes or demotes the last organizer', async () => {
      const { organizer, member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const members = client.trips[':tripId'].members[':userId'];
      const setRole = (userId: string, role: 'organizer' | 'member') =>
        members.role.$put({ ...memberPath(tripId, userId), json: { role } }, as(organizer));

      expect((await members.$delete(memberPath(tripId, organizer.id), as(organizer))).status).toBe(
        409,
      );
      expect((await setRole(organizer.id, 'member')).status).toBe(409);

      expect((await setRole(member.id, 'organizer')).status).toBe(200);
      expect((await setRole(organizer.id, 'member')).status).toBe(200);
      // The organizer stepped down, so they can't manage members any more.
      expect((await setRole(member.id, 'member')).status).toBe(403);
    });

    it('drops the claims of a removed member', async () => {
      const { organizer, member, data } = await tripWithMember();
      const item = data.items.find((i) => i.kind === 'single')!;
      await claim(member, data.trip.id, item.id, 1);

      const res = await client.trips[':tripId'].members[':userId'].$delete(
        memberPath(data.trip.id, member.id),
        as(organizer),
      );
      expect(res.status).toBe(200);
      const after = await (await detail(organizer, data.trip.id)).json();
      expect(after.claims).toEqual([]);
      expect((await detail(member, data.trip.id)).status).toBe(404);
      expect((await claim(member, data.trip.id, item.id, 1)).status).toBe(404);
    });

    it('lets a member leave, dropping their claims; not the last organizer', async () => {
      const { organizer, member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const leave = (user: Guest) =>
        client.trips[':tripId'].leave.$post({ param: { tripId } }, as(user));
      const item = data.items.find((i) => i.kind === 'single')!;
      await claim(member, tripId, item.id, 1);

      expect((await leave(organizer)).status).toBe(409);
      const res = await leave(member);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ userId: member.id, status: 'removed' });
      expect((await detail(member, tripId)).status).toBe(404);
      expect((await (await client.trips.$get({}, as(member))).json()).trips).toEqual([]);
      const after = await (await detail(organizer, tripId)).json();
      expect(after.claims).toEqual([]);
      expect(after.members.find((m) => m.userId === member.id)?.status).toBe('removed');
      expect(await activityTypes(tripId)).toContain('member_left');
      // Gone already.
      expect((await leave(member)).status).toBe(404);
    });

    it('lets a member who left join again from the link; not one who was removed', async () => {
      const { organizer, member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const removed = await guest('removed');
      await join(removed, data.inviteToken);
      await client.trips[':tripId'].members[':userId'].$delete(
        memberPath(tripId, removed.id),
        as(organizer),
      );
      await client.trips[':tripId'].leave.$post({ param: { tripId } }, as(member));

      const again = await join(member, data.inviteToken);
      expect(again.status).toBe(200);
      expect(await again.json()).toEqual({ tripId, status: 'active' });
      expect((await detail(member, tripId)).status).toBe(200);
      expect((await join(removed, data.inviteToken)).status).toBe(403);

      // Removed after coming back: the link no longer lets them in.
      await client.trips[':tripId'].members[':userId'].$delete(
        memberPath(tripId, member.id),
        as(organizer),
      );
      expect((await join(member, data.inviteToken)).status).toBe(403);
    });

    it('lets an organizer leave once another member is organizer', async () => {
      const { organizer, member, data } = await tripWithMember();
      const tripId = data.trip.id;
      await client.trips[':tripId'].members[':userId'].role.$put(
        { ...memberPath(tripId, member.id), json: { role: 'organizer' } },
        as(organizer),
      );
      expect(
        (await client.trips[':tripId'].leave.$post({ param: { tripId } }, as(organizer))).status,
      ).toBe(200);
      expect((await detail(member, tripId)).status).toBe(200);
    });
  });

  describe('adding people by email', () => {
    const addPerson = (user: Guest, tripId: string, email: string) =>
      client.trips[':tripId'].members.$post({ param: { tripId }, json: { email } }, as(user));

    it('adds someone who never signed in, so expenses can be split with them', async () => {
      const { member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const res = await addPerson(member, tripId, ' Yossi@Example.com ');
      expect(res.status).toBe(201);
      const { userId } = await res.json();

      const trip = await (await detail(member, tripId)).json();
      expect(trip.members.find((m) => m.userId === userId)).toMatchObject({
        displayName: 'yossi@example.com',
        role: 'member',
        status: 'active',
        invited: true,
      });
      expect(trip.members.find((m) => m.userId === member.id)?.invited).toBeUndefined();
      const [user] = await sql<{ email: string }[]>`select email from users where id = ${userId}`;
      expect(user!.email).toBe('yossi@example.com');
      expect(await activityTypes(tripId)).toContain('member_added');

      const expense = await client.trips[':tripId'].expenses.$post(
        {
          param: { tripId },
          json: { description: 'דלק', amountAgorot: 1000, shares: [member.id, userId] },
        },
        as(member),
      );
      expect(expense.status).toBe(201);
      const after = await (await detail(member, tripId)).json();
      expect(after.balances[userId]).toBe(-500);
    });

    it('adds the same person again in another trip, and changes nothing when already in', async () => {
      const a = await tripWithMember();
      const b = await tripWithMember();
      const first = await (await addPerson(a.organizer, a.data.trip.id, 'roni@example.com')).json();
      const again = await addPerson(a.organizer, a.data.trip.id, 'roni@example.com');
      expect(await again.json()).toEqual(first);
      const other = await (await addPerson(b.organizer, b.data.trip.id, 'RONI@example.com')).json();
      expect(other.userId).toBe(first.userId);
      const [row] = await sql<{ n: number }[]>`
        select count(*)::int as n from trip_members where user_id = ${first.userId}`;
      expect(row?.n).toBe(2);
    });

    it('adds an existing user by their email, and brings back one who was removed', async () => {
      const { organizer, member, data } = await tripWithMember();
      const tripId = data.trip.id;
      await sql`update users set email = 'member@example.com' where id = ${member.id}`;
      await client.trips[':tripId'].members[':userId'].$delete(
        { param: { tripId, userId: member.id } },
        as(organizer),
      );
      const res = await addPerson(organizer, tripId, 'member@example.com');
      expect(await res.json()).toEqual({ userId: member.id, status: 'active' });
      expect((await detail(member, tripId)).status).toBe(200);
    });

    it("links their first Google sign-in to them, with the trip and what's on them", async () => {
      // Google stubbed: any id token is valid and names this person.
      const auth = createAuth(createDb(sql), {
        baseURL: 'http://localhost:3000',
        secret: 'test-secret-at-least-32-characters-long',
        google: {
          clientId: 'test',
          clientSecret: 'test',
          verifyIdToken: async () => true,
          getUserInfo: async () => ({
            user: { id: 'g-1', email: 'Dana@Example.com', emailVerified: true, name: 'Dana Levi' },
            data: { sub: 'g-1' },
          }),
        } as AuthConfig['google'],
      });
      const { organizer, data } = await tripWithMember();
      const tripId = data.trip.id;
      const { userId } = await (await addPerson(organizer, tripId, 'dana@example.com')).json();

      const signedIn = await auth.api.signInSocial({
        body: { provider: 'google', idToken: { token: 'x' } },
      });
      expect('user' in signedIn && signedIn.user.id).toBe(userId);
      const trip = await (await detail(organizer, tripId)).json();
      expect(trip.members.find((m) => m.userId === userId)).toMatchObject({
        displayName: 'Dana Levi',
      });
      expect(trip.members.find((m) => m.userId === userId)?.invited).toBeUndefined();
    });

    it('takes organizers only when joining needs approval, and no strangers', async () => {
      const organizer = await guest('organizer');
      const data = await createTrip(organizer, { requireApproval: true });
      const tripId = data.trip.id;
      const member = await guest('member');
      await join(member, data.inviteToken);
      await client.trips[':tripId'].members[':userId'].approve.$post(
        { param: { tripId, userId: member.id } },
        as(organizer),
      );
      expect((await addPerson(member, tripId, 'x@example.com')).status).toBe(403);
      expect((await addPerson(await guest('stranger'), tripId, 'x@example.com')).status).toBe(404);
      expect((await addPerson(organizer, tripId, 'not-an-email')).status).toBe(400);
      expect((await addPerson(organizer, tripId, 'deleted-1@deleted.invalid')).status).toBe(400);
      expect((await addPerson(organizer, tripId, 'x@example.com')).status).toBe(201);
    });
  });

  describe('items and claims', () => {
    it('caps claims at what is still needed', async () => {
      const { organizer, member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const qty = data.items.find((i) => i.kind === 'qty')!;
      const each = data.items.find((i) => i.kind === 'each')!;

      expect((await claim(member, tripId, qty.id, qty.quantityNeeded + 1)).status).toBe(409);
      expect((await claim(member, tripId, qty.id, qty.quantityNeeded - 1)).status).toBe(200);
      const over = await claim(organizer, tripId, qty.id, 2);
      expect(over.status).toBe(409);
      expect(await over.json()).toEqual({ error: 'At most 1 can be claimed' });
      expect((await claim(organizer, tripId, qty.id, 1)).status).toBe(200);
      expect((await claim(member, tripId, each.id, 2)).status).toBe(409);

      // 0 drops the claim, freeing it for others.
      expect((await claim(member, tripId, qty.id, 0)).status).toBe(200);
      expect((await claim(organizer, tripId, qty.id, qty.quantityNeeded)).status).toBe(200);
      const after = await (await detail(member, tripId)).json();
      expect(after.claims).toEqual([
        {
          itemId: qty.id,
          userId: organizer.id,
          quantity: qty.quantityNeeded,
          arrived: false,
          packed: false,
        },
      ]);
    });

    it('lets only one of two racing claims take the last unit', async () => {
      const { organizer, member, data } = await tripWithMember();
      const item = data.items.find((i) => i.kind === 'single')!;
      const results = await Promise.all([
        claim(organizer, data.trip.id, item.id, 1),
        claim(member, data.trip.id, item.id, 1),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    });

    it('rejects claims from non-members', async () => {
      const { data } = await tripWithMember();
      const stranger = await guest('stranger');
      expect((await claim(stranger, data.trip.id, data.items[0]!.id, 1)).status).toBe(404);
    });

    it('adds, edits and soft-deletes items', async () => {
      const { organizer, member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const items = client.trips[':tripId'].items;

      const bad = await items.$post(
        { param: { tripId }, json: { list: 'buy', name: 'מים', kind: 'qty' } },
        as(member),
      );
      expect(bad.status).toBe(400);
      const added = await items.$post(
        {
          param: { tripId },
          json: { list: 'buy', name: 'מים', kind: 'qty', quantityNeeded: 6 },
        },
        as(member),
      );
      expect(added.status).toBe(201);
      const item = await added.json();
      const buyCount = data.items.filter((i) => i.list === 'buy').length;
      expect(item).toMatchObject({ name: 'מים', position: buyCount, quantityNeeded: 6 });

      await claim(organizer, tripId, item.id, 4);
      const edit = (json: { quantityNeeded?: number; note?: string | null }) =>
        items[':itemId'].$patch({ param: { tripId, itemId: item.id }, json }, as(member));
      expect((await edit({ quantityNeeded: 3 })).status).toBe(409);
      expect(await (await edit({ quantityNeeded: 8, note: 'מינרליים' })).json()).toMatchObject({
        quantityNeeded: 8,
        note: 'מינרליים',
      });

      const del = await items[':itemId'].$delete(
        { param: { tripId, itemId: item.id } },
        as(member),
      );
      expect(del.status).toBe(204);
      const after = await (await detail(member, tripId)).json();
      expect(after.items.map((i) => i.id)).not.toContain(item.id);
      expect(after.claims).toEqual([]);
      expect((await claim(organizer, tripId, item.id, 1)).status).toBe(404);
      expect(await activityTypes(tripId)).toEqual([
        'trip_created',
        'member_joined',
        'item_added',
        'claim_set',
        'item_updated',
        'item_deleted',
      ]);
    });

    describe('packed', () => {
      const pack = (user: Guest, tripId: string, itemId: string, packed: boolean) =>
        client.trips[':tripId'].items[':itemId'].packed.$put(
          { param: { tripId, itemId }, json: { packed } },
          as(user),
        );
      const claimsOf = async (user: Guest, tripId: string) =>
        (await (await detail(user, tripId)).json()).claims;

      it('packs my own claim, and the whole group sees it', async () => {
        const { organizer, member, data } = await tripWithMember();
        const tripId = data.trip.id;
        const single = data.items.find((i) => i.kind === 'single')!;
        await claim(member, tripId, single.id, 1);

        const res = await pack(member, tripId, single.id, true);
        expect(await res.json()).toEqual({ itemId: single.id, userId: member.id, packed: true });
        expect(await claimsOf(organizer, tripId)).toEqual([
          { itemId: single.id, userId: member.id, quantity: 1, arrived: false, packed: true },
        ]);
        // Packing twice is a no-op; unpacking clears it.
        expect((await pack(member, tripId, single.id, true)).status).toBe(200);
        expect((await pack(member, tripId, single.id, false)).status).toBe(200);
        expect((await claimsOf(member, tripId))[0]!.packed).toBe(false);
      });

      it("refuses anyone who doesn't own a claim on the item", async () => {
        const { organizer, member, data } = await tripWithMember();
        const tripId = data.trip.id;
        const [single, unclaimed] = data.items.filter((i) => i.kind === 'single');
        await claim(member, tripId, single!.id, 1);

        expect((await pack(organizer, tripId, single!.id, true)).status).toBe(409);
        expect((await pack(organizer, tripId, single!.id, false)).status).toBe(409);
        expect((await pack(member, tripId, unclaimed!.id, true)).status).toBe(409);
        const stranger = await guest('stranger');
        expect((await pack(stranger, tripId, single!.id, true)).status).toBe(404);
        const unknown = '00000000-0000-4000-8000-000000000000';
        expect((await pack(member, tripId, unknown, true)).status).toBe(404);
        expect((await claimsOf(member, tripId))[0]!.packed).toBe(false);
      });

      it('unpacks when I claim more, and stays packed when I claim less', async () => {
        const { member, data } = await tripWithMember();
        const tripId = data.trip.id;
        const qty = data.items.find((i) => i.kind === 'qty')!;
        const packedNow = async () => (await claimsOf(member, tripId))[0]!.packed;
        await claim(member, tripId, qty.id, 1);
        await pack(member, tripId, qty.id, true);

        await claim(member, tripId, qty.id, 2);
        expect(await packedNow()).toBe(false);
        await pack(member, tripId, qty.id, true);
        await claim(member, tripId, qty.id, 1);
        expect(await packedNow()).toBe(true);
        await claim(member, tripId, qty.id, 1);
        expect(await packedNow()).toBe(true);
      });
    });
  });

  describe('editing items', () => {
    const items = () => client.trips[':tripId'].items;
    type Changes = Parameters<ReturnType<typeof items>[':itemId']['$patch']>[0]['json'];
    const edit = (user: Guest, tripId: string, itemId: string, json: Changes) =>
      items()[':itemId'].$patch({ param: { tripId, itemId }, json }, as(user));

    it('changes any field and logs which ones changed', async () => {
      // Moving to the other list leaves the item's category behind.
      const { member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const item = data.items.find((i) => i.list === 'bring' && i.kind === 'single')!;
      const res = await edit(member, tripId, item.id, {
        name: 'כיסאות',
        list: 'buy',
        kind: 'qty',
        quantityNeeded: 6,
        unit: 'יח׳',
        displayQty: '6',
        note: 'מתקפלים',
      });
      expect(res.status).toBe(200);
      const buyCount = data.items.filter((i) => i.list === 'buy').length;
      expect(await res.json()).toEqual({
        id: item.id,
        list: 'buy',
        position: buyCount,
        name: 'כיסאות',
        kind: 'qty',
        quantityNeeded: 6,
        unit: 'יח׳',
        displayQty: '6',
        note: 'מתקפלים',
        createdBy: item.createdBy,
        createdAt: item.createdAt,
      });
      const [logged] = await sql<{ payload: { fields: string[] } }[]>`
        select payload from activity where trip_id = ${tripId} and type = 'item_updated'`;
      expect(logged!.payload.fields.sort()).toEqual(
        [
          'categoryId',
          'displayQty',
          'kind',
          'list',
          'name',
          'note',
          'quantityNeeded',
          'unit',
        ].sort(),
      );
    });

    it('keeps the quantity at or above what is claimed', async () => {
      const { organizer, member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const qty = data.items.find((i) => i.kind === 'qty')!;
      expect((await edit(member, tripId, qty.id, { quantityNeeded: 6 })).status).toBe(200);
      expect((await claim(organizer, tripId, qty.id, 3)).status).toBe(200);
      expect((await claim(member, tripId, qty.id, 2)).status).toBe(200);
      const low = await edit(member, tripId, qty.id, { quantityNeeded: 4 });
      expect(low.status).toBe(409);
      expect(await low.json()).toEqual({ error: 'Less than already claimed' });
      expect((await edit(member, tripId, qty.id, { quantityNeeded: 5 })).status).toBe(200);
      expect((await edit(member, tripId, qty.id, { quantityNeeded: 1 })).status).toBe(400);
    });

    it('changes the kind only while nobody claimed the item', async () => {
      const { organizer, member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const [free, taken] = data.items.filter((i) => i.kind === 'single');
      expect((await edit(member, tripId, free!.id, { kind: 'qty' })).status).toBe(400);
      const toQty = await edit(member, tripId, free!.id, { kind: 'qty', quantityNeeded: 3 });
      expect(await toQty.json()).toMatchObject({ kind: 'qty', quantityNeeded: 3 });
      expect(
        (await edit(member, tripId, free!.id, { kind: 'each', quantityNeeded: 1 })).status,
      ).toBe(200);

      await claim(organizer, tripId, taken!.id, 1);
      const res = await edit(member, tripId, taken!.id, { kind: 'each' });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'Already claimed' });
    });

    it('keeps a bought item on the buy list', async () => {
      const { organizer, member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const [bought, open] = data.items.filter((i) => i.list === 'buy' && i.kind !== 'each');
      const expense = await client.trips[':tripId'].expenses.$post(
        {
          param: { tripId },
          json: {
            description: 'x',
            amountAgorot: 1000,
            shares: [organizer.id],
            itemId: bought!.id,
          },
        },
        as(organizer),
      );
      expect(expense.status).toBe(201);
      const res = await edit(member, tripId, bought!.id, { list: 'bring' });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: 'Already bought' });
      expect((await edit(member, tripId, open!.id, { list: 'bring' })).status).toBe(200);
    });

    it('hides items from non-members', async () => {
      const { data } = await tripWithMember();
      const stranger = await guest('stranger');
      const res = await edit(stranger, data.trip.id, data.items[0]!.id, { name: 'x' });
      expect(res.status).toBe(404);
    });
  });

  describe('categories', () => {
    const categories = () => client.trips[':tripId'].categories;
    const add = (user: Guest, tripId: string, list: 'bring' | 'buy', name: string) =>
      categories().$post({ param: { tripId }, json: { list, name } }, as(user));
    const rename = (user: Guest, tripId: string, categoryId: string, name: string) =>
      categories()[':categoryId'].$patch(
        { param: { tripId, categoryId }, json: { name } },
        as(user),
      );
    const reorder = (user: Guest, tripId: string, list: 'bring' | 'buy', categoryIds: string[]) =>
      categories().order.$put({ param: { tripId }, json: { list, categoryIds } }, as(user));
    const remove = (user: Guest, tripId: string, categoryId: string) =>
      categories()[':categoryId'].$delete({ param: { tripId, categoryId } }, as(user));
    const listOf = async (user: Guest, tripId: string, list: 'bring' | 'buy') =>
      (await (await categories().$get({ param: { tripId } }, as(user))).json()).categories
        .filter((cat) => cat.list === list)
        .map((cat) => cat.name);
    const items = () => client.trips[':tripId'].items;

    it('adds, renames, reorders and deletes categories, and logs each', async () => {
      const { member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const before = await listOf(member, tripId, 'buy');

      const res = await add(member, tripId, 'buy', ' פירות ');
      expect(res.status).toBe(201);
      const fruit = await res.json();
      expect(fruit).toMatchObject({ list: 'buy', name: 'פירות', position: before.length });
      // Names are unique per list, ignoring case; the other list may reuse one.
      expect((await add(member, tripId, 'buy', 'פירות')).status).toBe(409);
      expect((await add(member, tripId, 'bring', 'פירות')).status).toBe(201);
      const fruitEn = await (await add(member, tripId, 'buy', 'Fruit')).json();
      expect((await add(member, tripId, 'buy', 'FRUIT')).status).toBe(409);
      expect((await rename(member, tripId, fruitEn.id, 'פירות')).status).toBe(409);
      expect((await rename(member, tripId, fruitEn.id, 'fruit')).status).toBe(200);

      expect(await (await rename(member, tripId, fruit.id, 'פירות וירקות')).json()).toMatchObject({
        id: fruit.id,
        name: 'פירות וירקות',
      });

      const ids = data.categories.filter((cat) => cat.list === 'buy').map((cat) => cat.id);
      const order = [fruit.id, ...ids.reverse(), fruitEn.id];
      const reordered = await reorder(member, tripId, 'buy', order);
      expect(reordered.status).toBe(200);
      expect((await reordered.json()).categories.map((cat) => cat.id)).toEqual(order);
      expect(await listOf(member, tripId, 'buy')).toEqual([
        'פירות וירקות',
        ...[...before].reverse(),
        'fruit',
      ]);
      // A stale order (missing, extra or repeated categories) is refused.
      expect((await reorder(member, tripId, 'buy', order.slice(1))).status).toBe(409);
      expect((await reorder(member, tripId, 'buy', [...order, order[0]!])).status).toBe(409);
      expect((await reorder(member, tripId, 'bring', order)).status).toBe(409);

      expect((await remove(member, tripId, fruitEn.id)).status).toBe(204);
      expect((await remove(member, tripId, fruitEn.id)).status).toBe(404);
      expect(await listOf(member, tripId, 'buy')).not.toContain('fruit');

      expect((await activityTypes(tripId)).slice(2)).toEqual([
        'category_added',
        'category_added',
        'category_added',
        'category_renamed',
        'category_renamed',
        'categories_reordered',
        'category_deleted',
      ]);
    });

    it('sets and clears a category color, without logging it', async () => {
      const { member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const patch = (categoryId: string, json: { name?: string; color?: number | null }) =>
        categories()[':categoryId'].$patch({ param: { tripId, categoryId }, json }, as(member));
      const category = data.categories[0]!;
      expect(category).not.toHaveProperty('color');

      expect(await (await patch(category.id, { color: 3 })).json()).toMatchObject({
        id: category.id,
        name: category.name,
        color: 3,
      });
      const after = await (await detail(member, tripId)).json();
      expect(after.categories.find((cat) => cat.id === category.id)?.color).toBe(3);
      // A rename keeps the color; null goes back to the color of its place.
      expect((await (await patch(category.id, { name: 'חדש' })).json()).color).toBe(3);
      expect(await (await patch(category.id, { color: null })).json()).not.toHaveProperty('color');
      for (const color of [-1, 6, 1.5]) {
        expect((await patch(category.id, { color })).status).toBe(400);
      }
      expect((await patch(category.id, {})).status).toBe(400);

      const created = await categories().$post(
        { param: { tripId }, json: { list: 'buy', name: 'פירות', color: 0 } },
        as(member),
      );
      expect(await created.json()).toMatchObject({ name: 'פירות', color: 0 });
      expect((await activityTypes(tripId)).slice(2)).toEqual([
        'category_renamed',
        'category_added',
      ]);
    });

    it('deletes a category with items: they become uncategorized', async () => {
      const { member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const category = data.categories[0]!;
      const inside = data.items.filter((i) => i.categoryId === category.id);
      expect(inside.length).toBeGreaterThan(0);
      await items()[':itemId'].$delete({ param: { tripId, itemId: inside[0]!.id } }, as(member));

      expect((await remove(member, tripId, category.id)).status).toBe(204);
      const after = await (await detail(member, tripId)).json();
      expect(after.categories.map((cat) => cat.id)).not.toContain(category.id);
      for (const { id } of inside.slice(1)) {
        expect(after.items.find((i) => i.id === id)).not.toHaveProperty('categoryId');
      }
    });

    it('puts items into a category of their list, or none', async () => {
      const { member, data } = await tripWithMember();
      const tripId = data.trip.id;
      const bringCat = data.categories.find((cat) => cat.list === 'bring')!;
      const buyCat = data.categories.find((cat) => cat.list === 'buy')!;
      const create = (categoryId?: string | null) =>
        items().$post(
          { param: { tripId }, json: { list: 'bring', name: 'מחצלת', kind: 'single', categoryId } },
          as(member),
        );
      const edit = (itemId: string, json: { categoryId?: string | null; list?: 'buy' }) =>
        items()[':itemId'].$patch({ param: { tripId, itemId }, json }, as(member));

      const created = await create(bringCat.id);
      expect(created.status).toBe(201);
      const item = await created.json();
      expect(item.categoryId).toBe(bringCat.id);
      expect((await create(buyCat.id)).status).toBe(400);
      expect((await create('00000000-0000-4000-8000-000000000000')).status).toBe(404);
      expect(await (await create(null)).json()).not.toHaveProperty('categoryId');

      expect((await edit(item.id, { categoryId: buyCat.id })).status).toBe(400);
      const other = data.categories.filter((cat) => cat.list === 'bring')[1]!;
      expect((await (await edit(item.id, { categoryId: other.id })).json()).categoryId).toBe(
        other.id,
      );
      expect(await (await edit(item.id, { categoryId: null })).json()).not.toHaveProperty(
        'categoryId',
      );
      const moved = await edit(item.id, { list: 'buy', categoryId: buyCat.id });
      expect(await moved.json()).toMatchObject({ list: 'buy', categoryId: buyCat.id });
    });

    it('hides categories from non-members', async () => {
      const { data } = await tripWithMember();
      const tripId = data.trip.id;
      const stranger = await guest('stranger');
      const category = data.categories[0]!;
      expect((await categories().$get({ param: { tripId } }, as(stranger))).status).toBe(404);
      expect((await add(stranger, tripId, 'bring', 'x')).status).toBe(404);
      expect((await rename(stranger, tripId, category.id, 'x')).status).toBe(404);
      expect((await reorder(stranger, tripId, 'bring', [category.id])).status).toBe(404);
      expect((await remove(stranger, tripId, category.id)).status).toBe(404);
      // A category of another trip can't be used, renamed or deleted through this one.
      const { member, data: mine } = await tripWithMember();
      expect((await rename(member, mine.trip.id, category.id, 'x')).status).toBe(404);
      expect((await remove(member, mine.trip.id, category.id)).status).toBe(404);
      expect(
        (
          await items().$post(
            {
              param: { tripId: mine.trip.id },
              json: { list: category.list, name: 'x', kind: 'single', categoryId: category.id },
            },
            as(member),
          )
        ).status,
      ).toBe(404);
    });
  });
});
