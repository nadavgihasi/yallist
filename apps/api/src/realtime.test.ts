import { testClient } from 'hono/testing';
import type { Sql } from 'postgres';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDb, type Db } from './db/client';
import { migrate } from './db/migrate';
import { authorize, type Publish } from './realtime';
import { createTestDatabase, DATABASE_URL, signInAsGuest, testApp, testAuth } from './test-db';

describe.skipIf(!DATABASE_URL)('realtime', () => {
  let sql: Sql;
  let drop: () => Promise<void>;
  let db: Db;
  let app: ReturnType<typeof testApp>;
  let client: ReturnType<typeof testClient<ReturnType<typeof testApp>>>;
  /** Each publish, with the trip's newest activity as seen from outside the request. */
  let published: { tripId: string; lastActivity: string | undefined }[];
  let publish: Publish;

  beforeAll(async () => {
    ({ sql, drop } = await createTestDatabase());
    await migrate(sql, { dsql: false });
    db = createDb(sql);
    app = testApp(db, (tripId) => publish(tripId));
    client = testClient(app);
  });

  beforeEach(() => {
    published = [];
    publish = async (tripId) => {
      const [last] = await sql<{ type: string }[]>`
        select type from activity where trip_id = ${tripId} order by created_at desc limit 1`;
      published.push({ tripId, lastActivity: last?.type });
    };
  });

  afterAll(() => drop());

  type Guest = Awaited<ReturnType<typeof signInAsGuest>>;
  const as = (user: Guest) => ({ headers: user.headers });

  async function tripOf(user: Guest, requireApproval = false) {
    const res = await client.trips.$post(
      {
        json: {
          name: 'צפון',
          startsOn: '2026-11-05',
          endsOn: '2026-11-07',
          template: 'camp',
          requireApproval,
        },
      },
      as(user),
    );
    return res.json();
  }

  describe('publishing', () => {
    it('publishes after a write to the trip commits', async () => {
      const dana = await signInAsGuest(app, 'דנה');
      const { trip, items } = await tripOf(dana);
      published = [];

      const res = await client.trips[':tripId'].items[':itemId'].claim.$put(
        { param: { tripId: trip.id, itemId: items[0]!.id }, json: { quantity: 1 } },
        as(dana),
      );
      expect(res.status).toBe(200);
      expect(published).toEqual([{ tripId: trip.id, lastActivity: 'claim_set' }]);

      await client.trips[':tripId'].$patch(
        { param: { tripId: trip.id }, json: { name: 'גליל' } },
        as(dana),
      );
      expect(published).toHaveLength(2);
    });

    it('publishes when someone packs', async () => {
      const dana = await signInAsGuest(app, 'דנה');
      const { trip, items } = await tripOf(dana);
      const param = { tripId: trip.id, itemId: items[0]!.id };
      await client.trips[':tripId'].items[':itemId'].claim.$put(
        { param, json: { quantity: 1 } },
        as(dana),
      );
      published = [];

      const res = await client.trips[':tripId'].items[':itemId'].packed.$put(
        { param, json: { packed: true } },
        as(dana),
      );
      expect(res.status).toBe(200);
      expect(published).toEqual([{ tripId: trip.id, lastActivity: 'claim_set' }]);
    });

    it('publishes when someone joins by invite', async () => {
      const dana = await signInAsGuest(app, 'דנה');
      const yoni = await signInAsGuest(app, 'יוני');
      const { trip, inviteToken } = await tripOf(dana, true);
      published = [];

      await client.invites[':token'].join.$post(
        { param: { token: inviteToken }, json: {} },
        as(yoni),
      );
      expect(published).toEqual([{ tripId: trip.id, lastActivity: 'member_requested' }]);
    });

    it('does not publish for reads or failed writes', async () => {
      const dana = await signInAsGuest(app, 'דנה');
      const stranger = await signInAsGuest(app, 'זר');
      const { trip, items } = await tripOf(dana);
      published = [];

      await client.trips[':tripId'].$get({ param: { tripId: trip.id } }, as(dana));
      const res = await client.trips[':tripId'].items[':itemId'].claim.$put(
        { param: { tripId: trip.id, itemId: items[0]!.id }, json: { quantity: 1 } },
        as(stranger),
      );
      expect(res.status).toBe(404);
      expect(published).toEqual([]);
    });

    it('still answers the write when publishing fails', async () => {
      const dana = await signInAsGuest(app, 'דנה');
      const { trip } = await tripOf(dana);
      publish = () => Promise.reject(new Error('AppSync down'));
      const error = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await client.trips[':tripId'].$patch(
        { param: { tripId: trip.id }, json: { name: 'גליל' } },
        as(dana),
      );
      expect(res.status).toBe(200);
      expect(error).toHaveBeenCalledWith('Realtime publish failed', expect.any(Error));
      error.mockRestore();
    });
  });

  describe('authorizer', () => {
    const check = (token: string, operation: string, channel?: string) =>
      authorize(testAuth(db), db, {
        authorizationToken: token,
        requestContext: { operation, channel },
      });

    it('lets a signed-in user connect, with or without "Bearer "', async () => {
      const dana = await signInAsGuest(app, 'דנה');
      expect(await check(dana.token, 'EVENT_CONNECT')).toBe(true);
      expect(await check(`Bearer ${dana.token}`, 'EVENT_CONNECT')).toBe(true);
    });

    it('rejects a bad token', async () => {
      const dana = await signInAsGuest(app, 'דנה');
      const { trip } = await tripOf(dana);
      expect(await check('not-a-token', 'EVENT_CONNECT')).toBe(false);
      expect(await check('', 'EVENT_SUBSCRIBE', `/trips/${trip.id}`)).toBe(false);
    });

    it('lets only active members subscribe to a trip', async () => {
      const dana = await signInAsGuest(app, 'דנה');
      const pending = await signInAsGuest(app, 'ממתין');
      const stranger = await signInAsGuest(app, 'זר');
      const { trip, inviteToken } = await tripOf(dana, true);
      await client.invites[':token'].join.$post(
        { param: { token: inviteToken }, json: {} },
        as(pending),
      );
      const channel = `/trips/${trip.id}`;

      expect(await check(dana.token, 'EVENT_SUBSCRIBE', channel)).toBe(true);
      expect(await check(pending.token, 'EVENT_SUBSCRIBE', channel)).toBe(false);
      expect(await check(stranger.token, 'EVENT_SUBSCRIBE', channel)).toBe(false);
    });

    it('rejects other channels and publishing', async () => {
      const dana = await signInAsGuest(app, 'דנה');
      const { trip } = await tripOf(dana);
      for (const channel of ['/trips/*', `/trips/${trip.id}/x`, `/other/${trip.id}`, undefined]) {
        expect(await check(dana.token, 'EVENT_SUBSCRIBE', channel)).toBe(false);
      }
      expect(await check(dana.token, 'EVENT_PUBLISH', `/trips/${trip.id}`)).toBe(false);
    });
  });
});
