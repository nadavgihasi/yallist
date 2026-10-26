import { testClient } from 'hono/testing';
import type { Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AVATAR_MAX_BYTES } from '../avatars';
import { createDb } from '../db/client';
import { migrate } from '../db/migrate';
import { createTestDatabase, DATABASE_URL, signInAsGuest, testApp, testReceipts } from '../test-db';

describe.skipIf(!DATABASE_URL)('profile photos', () => {
  let sql: Sql;
  let drop: () => Promise<void>;
  let app: ReturnType<typeof testApp>;
  let client: ReturnType<typeof testClient<ReturnType<typeof testApp>>>;
  const bucket = testReceipts();

  beforeAll(async () => {
    ({ sql, drop } = await createTestDatabase());
    await migrate(sql, { dsql: false });
    app = testApp(createDb(sql), undefined, undefined, bucket.store);
    client = testClient(app);
  });

  afterAll(() => drop());

  type Guest = Awaited<ReturnType<typeof signInAsGuest>>;
  const as = (user: Guest) => ({ headers: user.headers });
  const avatar = () => client.me.avatar;

  const uploadUrl = (
    user: Guest,
    json: { contentType: 'image/jpeg' | 'image/png' | 'image/webp'; size: number } = {
      contentType: 'image/jpeg',
      size: 1000,
    },
  ) => avatar()['upload-url'].$post({ json }, as(user));

  /** Uploads like the app does: the form fields, then the file. */
  async function upload(form: { url: string; fields: Record<string, string> }, file: Blob) {
    const body = new FormData();
    for (const [name, value] of Object.entries(form.fields)) body.append(name, value);
    body.append('file', file);
    return bucket.routes.request(new URL(form.url).pathname, { method: 'POST', body });
  }

  /** Uploads a photo and makes it the user's; returns its key. */
  async function setPhoto(user: Guest) {
    const form = await (await uploadUrl(user)).json();
    expect((await upload(form, new Blob(['jpeg']))).status).toBe(204);
    expect((await avatar().$post({ json: { key: form.key } }, as(user))).status).toBe(200);
    return form.key;
  }

  const me = async (user: Guest) => (await client.me.$get({}, as(user))).json();

  it('uploads into the user’s directory, replaces the old photo and removes it', async () => {
    const user = await signInAsGuest(app, 'דנה');
    const res = await uploadUrl(user);
    expect(res.status).toBe(200);
    const form = await res.json();
    expect(form.key).toMatch(new RegExp(`^avatars/${user.id}/[0-9a-f-]{36}\\.jpg$`));
    expect(form.fields).toMatchObject({ 'Content-Type': 'image/jpeg' });

    // Not uploaded yet.
    expect((await avatar().$post({ json: { key: form.key } }, as(user))).status).toBe(400);
    expect((await upload(form, new Blob(['jpeg']))).status).toBe(204);
    const attached = await avatar().$post({ json: { key: form.key } }, as(user));
    expect(attached.status).toBe(200);
    expect(await attached.json()).toMatchObject({
      avatarUrl: expect.stringContaining(form.key),
      customAvatar: true,
    });
    expect(await me(user)).toMatchObject({ avatarUrl: expect.stringContaining(form.key) });

    // A new photo replaces it, and the old one is deleted.
    const second = await setPhoto(user);
    expect(bucket.objects.has(form.key)).toBe(false);
    expect(await me(user)).toMatchObject({ avatarUrl: expect.stringContaining(second) });

    const removed = await avatar().$delete({}, as(user));
    expect(removed.status).toBe(200);
    expect(await removed.json()).toMatchObject({ avatarUrl: null, customAvatar: false });
    expect(bucket.objects.has(second)).toBe(false);
    // Removing again changes nothing.
    expect((await avatar().$delete({}, as(user))).status).toBe(200);
  });

  it('takes JPEG, PNG or WebP of at most 5 MB only', async () => {
    const user = await signInAsGuest(app, 'דנה');
    const ask = (contentType: string, size: number) =>
      uploadUrl(user, { contentType: contentType as 'image/png', size });
    expect((await ask('image/png', 1000)).status).toBe(200);
    expect((await ask('image/webp', AVATAR_MAX_BYTES)).status).toBe(200);
    expect((await ask('image/heic', 1000)).status).toBe(400);
    expect((await ask('image/gif', 1000)).status).toBe(400);
    expect((await ask('image/svg+xml', 1000)).status).toBe(400);
    expect((await ask('image/jpeg', AVATAR_MAX_BYTES + 1)).status).toBe(400);
    expect((await ask('image/jpeg', 0)).status).toBe(400);

    // The upload itself is held to the form's type and size.
    const form = await (await ask('image/png', 1000)).json();
    const big = new Blob([new Uint8Array(AVATAR_MAX_BYTES + 1)]);
    expect((await upload(form, big)).status).toBe(400);
    expect(
      (await upload({ ...form, fields: { ...form.fields, 'Content-Type': 'text/html' } }, big))
        .status,
    ).toBe(403);
  });

  it('only attaches keys it handed out to that user', async () => {
    const [user, other] = await Promise.all(['a', 'b'].map((n) => signInAsGuest(app, n)));
    const form = await (await uploadUrl(other!)).json();
    await upload(form, new Blob(['jpeg']));
    const attach = (key: string) => avatar().$post({ json: { key } }, as(user!));
    expect((await attach(form.key)).status).toBe(400);
    expect((await attach(`avatars/${user!.id}/../${other!.id}/x.jpg`)).status).toBe(400);
    expect((await attach(`avatars/${user!.id}/x.html`)).status).toBe(400);
    expect((await attach(`trips/x/receipts/y/${form.key.split('/').pop()}`)).status).toBe(400);
  });

  it('requires a session', async () => {
    expect((await app.request('/me/avatar/upload-url', { method: 'POST' })).status).toBe(401);
    expect((await app.request('/me/avatar', { method: 'DELETE' })).status).toBe(401);
  });

  it('shows the Google picture until a photo is uploaded, and again after it is removed', async () => {
    const user = await signInAsGuest(app, 'דנה');
    // What Better Auth stores from a Google sign-in.
    await sql`
      update users set image = 'https://lh3.googleusercontent.com/a/abc=s96-c', is_anonymous = false
      where id = ${user.id}`;
    const google = 'https://lh3.googleusercontent.com/a/abc=s256-c';
    expect(await me(user)).toMatchObject({ avatarUrl: google, customAvatar: false });
    const key = await setPhoto(user);
    expect(await me(user)).toMatchObject({ avatarUrl: expect.stringContaining(key) });
    await avatar().$delete({}, as(user));
    expect(await me(user)).toMatchObject({ avatarUrl: google, customAvatar: false });
  });

  it('shows photos to active trip-mates only', async () => {
    const [a, b, p, stranger] = await Promise.all(
      ['a', 'b', 'p', 'stranger'].map((n) => signInAsGuest(app, n)),
    );
    const json = {
      name: 'Grill',
      startsOn: '2026-11-05',
      endsOn: '2026-11-05',
      template: 'grill' as const,
      requireApproval: true,
    };
    const data = await (await client.trips.$post({ json }, as(a!))).json();
    const tripId = data.trip.id;
    const token = data.inviteToken;
    for (const user of [b!, p!]) {
      await client.invites[':token'].join.$post({ param: { token }, json: {} }, as(user));
    }
    await client.trips[':tripId'].members[':userId'].approve.$post(
      { param: { tripId, userId: b!.id } },
      as(a!),
    );
    const [keyA, keyP] = [await setPhoto(a!), await setPhoto(p!)];

    // Active members see each other's photos, on the trip and in the trips list.
    const detail = await (await client.trips[':tripId'].$get({ param: { tripId } }, as(b!))).json();
    const photoOf = (members: typeof detail.members, id: string) =>
      members.find((m) => m.userId === id)?.avatarUrl;
    expect(photoOf(detail.members, a!.id)).toContain(keyA);
    expect(photoOf(detail.members, b!.id)).toBeUndefined();
    // A pending member's photo isn't shown to the trip until they're approved.
    expect(photoOf(detail.members, p!.id)).toBeUndefined();
    const list = await (await client.trips.$get({}, as(b!))).json();
    expect(photoOf(list.trips[0]!.members, a!.id)).toContain(keyA);
    expect(JSON.stringify(list)).not.toContain(keyP);

    // Strangers and pending members get nothing: not the trip, not the invite preview.
    for (const user of [p!, stranger!]) {
      expect((await client.trips[':tripId'].$get({ param: { tripId } }, as(user))).status).toBe(
        404,
      );
      const trips = await (await client.trips.$get({}, as(user))).json();
      expect(JSON.stringify(trips)).not.toContain(keyA);
    }
    const preview = await client.invites[':token'].$get({ param: { token } });
    expect(JSON.stringify(await preview.json())).not.toContain('avatars/');
  });
});
