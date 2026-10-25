import type { Sql } from 'postgres';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDb, type Db } from './db/client';
import { migrate } from './db/migrate';
import { ISSUE_LIMIT, sendUnsentFeedback } from './feedback-issue';
import { createTestDatabase, DATABASE_URL, signInAsGuest, testApp } from './test-db';

describe('feedbackToken', () => {
  afterEach(() => vi.restoreAllMocks());

  it('warns once when there is no token', async () => {
    vi.resetModules();
    const { feedbackToken } = await import('./feedback-issue');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(feedbackToken('token')).toBe('token');
    expect(warn).not.toHaveBeenCalled();
    for (const value of [undefined, '', 'unset']) expect(feedbackToken(value)).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe.skipIf(!DATABASE_URL)('sendUnsentFeedback', () => {
  let sql: Sql;
  let drop: () => Promise<void>;
  let db: Db;
  let userId: string;

  beforeAll(async () => {
    ({ sql, drop } = await createTestDatabase());
    await migrate(sql, { dsql: false });
    db = createDb(sql);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    userId = (await signInAsGuest(testApp(db), 'דנה')).id;
  });

  afterAll(() => drop());
  beforeEach(() => sql`delete from feedback`);
  afterEach(() => vi.restoreAllMocks());

  /** Saves a request; `issue` and `claimedAgo` (an interval) set its issue columns. */
  const save = async (title: string, { issue = null as number | null, claimedAgo = '' } = {}) => {
    const [row] = await sql<{ id: string }[]>`
      insert into feedback
        (user_id, title, body, app_version, platform, stage, github_issue_number, github_issue_at)
      values (${userId}, ${title}, 'cc @octocat', '1.4.0', 'web', 'dev', ${issue},
        ${claimedAgo ? sql`now() - ${claimedAgo}::interval` : null})
      returning id`;
    return row!.id;
  };

  const issueNumbers = async () =>
    Object.fromEntries(
      (await sql`select title, github_issue_number from feedback`).map((r) => [
        r.title,
        r.github_issue_number,
      ]),
    );

  /** Stubs GitHub's API: issues get numbers from 100 up, after `delayMs`; `status` fails them. */
  const stubGitHub = ({ status = 201, delayMs = 0 } = {}) => {
    let next = 100;
    return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return Response.json(status === 201 ? { number: next++ } : {}, { status });
    });
  };

  it('opens the missing issues, oldest first, once', async () => {
    const fetch = stubGitHub();
    await save('First');
    await save('Second');
    await save('Sent', { issue: 7, claimedAgo: '1 day' });
    await save('In flight', { claimedAgo: '1 minute' });
    await save('Crashed', { claimedAgo: '11 minutes' });

    expect(await sendUnsentFeedback(db, 'token')).toEqual({ sent: 3, waiting: 3 });
    expect(await issueNumbers()).toEqual({
      First: 100,
      Second: 101,
      Sent: 7,
      'In flight': null,
      Crashed: 102,
    });
    const issue = JSON.parse(fetch.mock.calls[0]![1]!.body as string);
    expect(issue).toMatchObject({ title: 'First', labels: ['feature-request', 'untrusted'] });
    expect(issue.body).toMatch(/^> \[!WARNING\]/);
    expect(issue.body).toContain('cc @​octocat');
    expect(issue.body).not.toContain(userId);

    expect(await sendUnsentFeedback(db, 'token')).toEqual({ sent: 0, waiting: 0 });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it(`stops at ${ISSUE_LIMIT} issues a day, counting when they were opened`, async () => {
    stubGitHub();
    for (let i = 1; i < ISSUE_LIMIT; i++)
      await save(`Recent ${i}`, { issue: i, claimedAgo: '1 hour' });
    await save('Old', { issue: 999, claimedAgo: '25 hours' });
    await save('A');
    await save('B');

    expect(await sendUnsentFeedback(db, 'token')).toEqual({ sent: 1, waiting: 2 });
    expect(await issueNumbers()).toMatchObject({ A: 100, B: null });
  });

  it('releases the claim when GitHub fails, so the next run retries', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    stubGitHub({ status: 500 });
    const id = await save('First');
    expect(await sendUnsentFeedback(db, 'token')).toEqual({ sent: 0, waiting: 1 });
    expect(await sql`select github_issue_at from feedback where id = ${id}`).toEqual([
      { github_issue_at: null },
    ]);

    vi.restoreAllMocks();
    stubGitHub();
    expect(await sendUnsentFeedback(db, 'token')).toEqual({ sent: 1, waiting: 1 });
  });

  it('opens each issue once when runs overlap', async () => {
    const fetch = stubGitHub({ delayMs: 20 });
    for (const title of ['A', 'B', 'C']) await save(title);

    const runs = await Promise.all([1, 2, 3].map(() => sendUnsentFeedback(db, 'token')));
    expect(runs.reduce((total, run) => total + run.sent, 0)).toBe(3);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(Object.values(await issueNumbers()).sort()).toEqual([100, 101, 102]);
  });
});
