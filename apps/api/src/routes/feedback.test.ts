import type { Sql } from 'postgres';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type Db } from '../db/client';
import { migrate } from '../db/migrate';
import { ISSUE_LIMIT } from '../feedback-issue';
import { createTestDatabase, DATABASE_URL, signInAsGuest, testApp } from '../test-db';

import { FEEDBACK_LIMIT } from './feedback';

const request = {
  kind: 'feature',
  title: 'Dark mode',
  body: 'Please add a dark theme.',
  appVersion: '1.4.0',
  platform: 'android',
};

describe.skipIf(!DATABASE_URL)('POST /feedback', () => {
  let sql: Sql;
  let drop: () => Promise<void>;
  let db: Db;

  beforeAll(async () => {
    ({ sql, drop } = await createTestDatabase());
    await migrate(sql, { dsql: false });
    db = createDb(sql);
  });

  afterAll(() => drop());
  afterEach(() => vi.restoreAllMocks());

  const appWith = (githubToken?: string) =>
    testApp(db, undefined, { stage: 'dev', ...(githubToken !== undefined && { githubToken }) });

  const post = async (
    app: ReturnType<typeof testApp>,
    headers: Record<string, string>,
    body: unknown,
  ) =>
    app.request('/feedback', {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  const rowsOf = (userId: string) => sql`
    select kind, title, body, app_version, platform, stage, github_issue_number
    from feedback where user_id = ${userId}`;

  /** Stubs GitHub's API, answering issue creation with `status`. */
  const stubGitHub = (status = 201) =>
    vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () =>
        Response.json(status === 201 ? { number: 42 } : {}, { status }),
      );

  it('saves the request, without calling GitHub when there is no token', async () => {
    const fetch = stubGitHub();
    for (const app of [appWith(), appWith(''), appWith('unset')]) {
      const user = await signInAsGuest(app, 'דנה');
      const res = await post(app, user.headers, {
        title: '  Dark mode ',
        platform: 'web',
        appVersion: '1.4.0',
      });
      expect(res.status).toBe(201);
      expect(await rowsOf(user.id)).toEqual([
        {
          kind: 'feature',
          title: 'Dark mode',
          body: '',
          app_version: '1.4.0',
          platform: 'web',
          stage: 'dev',
          github_issue_number: null,
        },
      ]);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it('opens a labelled GitHub issue without personal data and stores its number', async () => {
    const fetch = stubGitHub();
    const app = appWith('token');
    const user = await signInAsGuest(app, 'דנה כהן');
    await sql`update profiles set payment_phone = '+972501234567' where id = ${user.id}`;

    expect((await post(app, user.headers, { ...request, kind: 'bug' })).status).toBe(201);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('https://api.github.com/repos/nadavgihasi/yallist/issues');
    expect(new Headers(init!.headers).get('authorization')).toBe('Bearer token');
    const issue = JSON.parse(init!.body as string);
    expect(issue).toMatchObject({ title: 'Dark mode', labels: ['bug', 'untrusted'] });
    expect(issue.body).toMatch(/^> \[!WARNING\]\n> User-submitted, untrusted content/);
    expect(issue.body).toContain('Please add a dark theme.');
    expect(issue.body).toContain('App version: 1.4.0');
    expect(issue.body).toContain('Platform: android');
    expect(issue.body).toContain('Stage: dev');
    const [account] = await sql`select email from users where id = ${user.id}`;
    for (const personal of [user.id, 'דנה', '0501234567', '+972501234567', account!.email]) {
      expect(init!.body).not.toContain(personal);
    }
    expect(await rowsOf(user.id)).toMatchObject([{ kind: 'bug', github_issue_number: 42 }]);

    await post(app, user.headers, request);
    expect(JSON.parse(fetch.mock.calls[1]![1]!.body as string).labels).toEqual([
      'feature-request',
      'untrusted',
    ]);
  });

  it('defangs mentions, links and images in the issue', async () => {
    const fetch = stubGitHub();
    const app = appWith('token');
    const user = await signInAsGuest(app, 'דנה');
    const body = [
      'cc @nadavgihasi',
      '![pixel](https://evil.example/track.png)',
      '[click](https://evil.example/phish)',
      'https://evil.example/raw',
      '```',
      '</details> **bold**',
    ].join('\n');
    await post(app, user.headers, { ...request, title: 'Hey @octocat', body });

    const issue = JSON.parse(fetch.mock.calls[0]![1]!.body as string);
    expect(issue.title).toBe('Hey @\u200boctocat');
    // Everything the user wrote is inside one code block, whose fence their ``` can't close.
    const [, fence, inside] = issue.body.match(/\n(`{4,})\n([\s\S]*)\n\1\n/)!;
    expect(fence).toBe('````');
    expect(inside).toContain('cc @\u200bnadavgihasi');
    expect(inside).toContain('![pixel](https://evil.example/track.png)');
    expect(inside).toContain('[click](https://evil.example/phish)');
    const outside = issue.body.replace(inside, '');
    expect(outside).not.toMatch(/@(?!\u200b)|evil\.example|\]\(/);
  });

  it(`opens at most ${ISSUE_LIMIT} issues a day, then only saves`, async () => {
    const fetch = stubGitHub();
    const app = appWith('token');
    const user = await signInAsGuest(app, 'דנה');
    const other = await signInAsGuest(app, 'רון');
    await sql`
      insert into feedback
        (user_id, title, body, app_version, platform, stage, github_issue_number, github_issue_at)
      select ${other.id}, 'Old', '', '1.0.0', 'web', 'dev', n, now()
      from generate_series(1, ${ISSUE_LIMIT}) n`;

    expect((await post(app, user.headers, request)).status).toBe(201);
    expect(fetch).not.toHaveBeenCalled();
    expect(await rowsOf(user.id)).toMatchObject([{ github_issue_number: null }]);

    await sql`
      update feedback set github_issue_at = now() - interval '25 hours' where user_id = ${other.id}`;
    expect((await post(app, user.headers, request)).status).toBe(201);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('still succeeds when GitHub fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = appWith('token');
    for (const fail of [
      () => stubGitHub(500),
      () => vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline')),
    ]) {
      fail();
      const user = await signInAsGuest(app, 'דנה');
      expect((await post(app, user.headers, request)).status).toBe(201);
      expect(await rowsOf(user.id)).toMatchObject([
        { title: 'Dark mode', github_issue_number: null },
      ]);
    }
  });

  it(`allows ${FEEDBACK_LIMIT} requests per user per hour`, async () => {
    const app = appWith();
    const user = await signInAsGuest(app, 'דנה');
    const other = await signInAsGuest(app, 'רון');
    for (let i = 0; i < FEEDBACK_LIMIT; i++) {
      expect((await post(app, user.headers, request)).status).toBe(201);
    }
    expect((await post(app, user.headers, request)).status).toBe(429);
    expect((await post(app, other.headers, request)).status).toBe(201);
    await sql`delete from feedback where user_id = ${user.id}`;

    // Concurrent requests can't all slip past the count.
    const burst = await Promise.all(
      Array.from({ length: FEEDBACK_LIMIT + 3 }, () => post(app, user.headers, request)),
    );
    expect(burst.filter((res) => res.status === 201)).toHaveLength(FEEDBACK_LIMIT);

    await sql`update feedback set created_at = now() - interval '61 minutes' where user_id = ${user.id}`;
    expect((await post(app, user.headers, request)).status).toBe(201);
  });

  it.each([
    { title: 'ab' },
    { title: '  a  ' },
    { title: 'x'.repeat(121) },
    { body: 'x'.repeat(4001) },
    { kind: 'question' },
    { platform: 'windows' },
    { appVersion: '' },
    { userId: '00000000-0000-0000-0000-000000000000' },
  ])('rejects %o with 400', async (change) => {
    const app = appWith();
    const user = await signInAsGuest(app, 'דנה');
    expect((await post(app, user.headers, { ...request, ...change })).status).toBe(400);
    expect(await rowsOf(user.id)).toEqual([]);
  });

  it('requires a session', async () => {
    const app = appWith();
    expect((await post(app, {}, request)).status).toBe(401);
    expect((await post(app, { authorization: 'Bearer nope' }, request)).status).toBe(401);
  });
});
