import { testClient } from 'hono/testing';
import type { Sql } from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb } from '../db/client';
import { migrate } from '../db/migrate';
import { RECEIPT_MAX_BYTES } from '../receipts';
import { createTestDatabase, DATABASE_URL, signInAsGuest, testApp, testReceipts } from '../test-db';

describe.skipIf(!DATABASE_URL)('receipts', () => {
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

  /** A trip with approval on: `a` organizes, `b` is active, `p` waits for approval. */
  async function trip() {
    const [a, b, p] = await Promise.all(['a', 'b', 'p'].map((n) => signInAsGuest(app, n)));
    const json = {
      name: 'Grill',
      startsOn: '2026-11-05',
      endsOn: '2026-11-05',
      template: 'grill' as const,
      requireApproval: true,
    };
    const data = await (await client.trips.$post({ json }, as(a!))).json();
    const tripId = data.trip.id;
    const members = client.trips[':tripId'].members[':userId'];
    for (const user of [b!, p!]) {
      const token = data.inviteToken;
      await client.invites[':token'].join.$post({ param: { token }, json: {} }, as(user));
    }
    await members.approve.$post({ param: { tripId, userId: b!.id } }, as(a!));
    const expense = await (
      await client.trips[':tripId'].expenses.$post(
        { param: { tripId }, json: { description: 'פחמים', amountAgorot: 100, shares: [a!.id] } },
        as(a!),
      )
    ).json();
    return { a: a!, b: b!, p: p!, tripId, expenseId: expense.id };
  }

  const receipt = (tripId: string, expenseId: string) =>
    client.trips[':tripId'].expenses[':expenseId'].receipt;
  const uploadUrl = (
    user: Guest,
    tripId: string,
    expenseId: string,
    json: { contentType: 'image/jpeg' | 'image/png' | 'image/heic'; size: number } = {
      contentType: 'image/jpeg',
      size: 1000,
    },
  ) =>
    receipt(tripId, expenseId)['upload-url'].$post(
      { param: { tripId, expenseId }, json },
      as(user),
    );

  /** Uploads like the app does: the form fields, then the file. */
  async function upload(form: { url: string; fields: Record<string, string> }, file: Blob) {
    const body = new FormData();
    for (const [name, value] of Object.entries(form.fields)) body.append(name, value);
    body.append('file', file);
    return bucket.routes.request(new URL(form.url).pathname, { method: 'POST', body });
  }

  async function attach(user: Guest, tripId: string, expenseId: string) {
    const form = await (await uploadUrl(user, tripId, expenseId)).json();
    expect((await upload(form, new Blob(['jpeg'], { type: 'image/jpeg' }))).status).toBe(204);
    return receipt(tripId, expenseId).$post(
      { param: { tripId, expenseId }, json: { key: form.key } },
      as(user),
    );
  }

  const detail = async (user: Guest, tripId: string) =>
    (await client.trips[':tripId'].$get({ param: { tripId } }, as(user))).json();

  it('uploads into the trip directory, then shows and deletes it', async () => {
    const { a, b, tripId, expenseId } = await trip();
    const res = await uploadUrl(b, tripId, expenseId);
    expect(res.status).toBe(200);
    const form = await res.json();
    expect(form.key).toMatch(
      new RegExp(`^trips/${tripId}/receipts/${expenseId}/[0-9a-f-]{36}\\.jpg$`),
    );
    expect(form.fields).toMatchObject({ 'Content-Type': 'image/jpeg' });

    const param = { param: { tripId, expenseId } };
    // Not uploaded yet.
    expect(
      (await receipt(tripId, expenseId).$post({ ...param, json: { key: form.key } }, as(b))).status,
    ).toBe(400);
    expect((await upload(form, new Blob(['jpeg']))).status).toBe(204);
    expect(
      (await receipt(tripId, expenseId).$post({ ...param, json: { key: form.key } }, as(b))).status,
    ).toBe(204);
    expect((await detail(a, tripId)).expenses[0]).toMatchObject({ hasReceipt: true });

    const view = await receipt(tripId, expenseId).$get(param, as(a));
    expect(view.status).toBe(200);
    const { url } = await view.json();
    expect(url).toContain(form.key);

    // One receipt per expense: replacing takes deleting it first.
    expect((await attach(a, tripId, expenseId)).status).toBe(409);
    // Only who added or paid it, or an organizer.
    expect((await receipt(tripId, expenseId).$delete(param, as(b))).status).toBe(403);
    expect((await receipt(tripId, expenseId).$delete(param, as(a))).status).toBe(204);
    expect(bucket.objects.has(form.key)).toBe(false);
    expect((await receipt(tripId, expenseId).$get(param, as(a))).status).toBe(404);
    expect((await detail(a, tripId)).expenses[0]).toMatchObject({ hasReceipt: false });

    const types = await sql<{ type: string }[]>`
      select type from activity where trip_id = ${tripId} and type like 'receipt_%'
      order by created_at`;
    expect(types.map((t) => t.type)).toEqual(['receipt_added', 'receipt_deleted']);
  });

  it('is for active members only', async () => {
    const { a, p, tripId, expenseId } = await trip();
    const stranger = await signInAsGuest(app, 'stranger');
    const param = { param: { tripId, expenseId } };
    expect((await attach(a, tripId, expenseId)).status).toBe(204);
    for (const user of [p, stranger]) {
      expect((await uploadUrl(user, tripId, expenseId)).status).toBe(404);
      expect((await receipt(tripId, expenseId).$get(param, as(user))).status).toBe(404);
      expect((await receipt(tripId, expenseId).$delete(param, as(user))).status).toBe(404);
    }
    // An expense of another trip, under this trip's id.
    const other = await trip();
    expect((await uploadUrl(a, tripId, other.expenseId)).status).toBe(404);
  });

  it('takes images of at most 10 MB only', async () => {
    const { a, tripId, expenseId } = await trip();
    const ask = (contentType: string, size: number) =>
      uploadUrl(a, tripId, expenseId, { contentType: contentType as 'image/png', size });
    expect((await ask('image/png', 1000)).status).toBe(200);
    expect((await ask('image/heic', RECEIPT_MAX_BYTES)).status).toBe(200);
    expect((await ask('image/gif', 1000)).status).toBe(400);
    expect((await ask('application/pdf', 1000)).status).toBe(400);
    expect((await ask('image/jpeg', RECEIPT_MAX_BYTES + 1)).status).toBe(400);
    expect((await ask('image/jpeg', 0)).status).toBe(400);

    // The upload itself is held to the form's type and size.
    const form = await (await ask('image/png', 1000)).json();
    const big = new Blob([new Uint8Array(RECEIPT_MAX_BYTES + 1)]);
    expect((await upload(form, big)).status).toBe(400);
    expect(
      (await upload({ ...form, fields: { ...form.fields, 'Content-Type': 'text/html' } }, big))
        .status,
    ).toBe(403);
  });

  it('only attaches keys it handed out for that expense', async () => {
    const { a, tripId, expenseId } = await trip();
    const other = await trip();
    const form = await (await uploadUrl(a, tripId, expenseId)).json();
    await upload(form, new Blob(['jpeg']));
    const confirm = (key: string, ids = { tripId, expenseId }) =>
      receipt(ids.tripId, ids.expenseId).$post({ param: ids, json: { key } }, as(a));
    expect((await confirm(`trips/${tripId}/receipts/${expenseId}/../x.jpg`)).status).toBe(400);
    expect((await confirm(`trips/${tripId}/receipts/${expenseId}/x.html`)).status).toBe(400);
    // The other trip's expense can't take this trip's file.
    expect((await confirm(form.key, other)).status).toBe(400);
    expect((await confirm(form.key)).status).toBe(204);
  });

  it('deletes the photo with its expense', async () => {
    const { a, tripId, expenseId } = await trip();
    const form = await (await uploadUrl(a, tripId, expenseId)).json();
    await upload(form, new Blob(['jpeg']));
    await receipt(tripId, expenseId).$post(
      { param: { tripId, expenseId }, json: { key: form.key } },
      as(a),
    );
    expect(bucket.objects.has(form.key)).toBe(true);
    const res = await client.trips[':tripId'].expenses[':expenseId'].$delete(
      { param: { tripId, expenseId } },
      as(a),
    );
    expect(res.status).toBe(204);
    expect(bucket.objects.has(form.key)).toBe(false);
  });
});
