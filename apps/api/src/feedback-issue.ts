import { createHmac } from 'node:crypto';

import {
  claimFeedbackIssue,
  countIssuesSince,
  listUnsentFeedback,
  releaseFeedbackIssue,
  setFeedbackIssue,
  type Feedback,
} from './dal/feedback';
import type { Db } from './db/client';
import { transact } from './db/tx';
import { createIssue } from './github';

/** GitHub issues per day across all users; past it, requests are only saved. */
export const ISSUE_LIMIT = 50;
/** A claim this old is from a sender that died mid-send; another may take over. */
const CLAIM_TIMEOUT_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const staleBefore = () => new Date(Date.now() - CLAIM_TIMEOUT_MS);

const LABELS = { feature: 'feature-request', bug: 'bug' } as const;

let warned = false;

/**
 * The stage's GitHub token, or null without one: unset, or SST's `unset` placeholder. Warns
 * (once per process) then, so requests not becoming issues shows in the logs.
 */
export function feedbackToken(value: string | undefined) {
  if (value && value !== 'unset') return value;
  if (!warned) console.warn('No GithubFeedbackToken: feedback is saved without opening issues');
  warned = true;
  return null;
}

/** Breaks @mentions (a zero-width space after the @), so an issue can't ping anyone. */
const breakMentions = (text: string) => text.replaceAll('@', '@​');

/**
 * User text as an inert code block: no links, images, mentions or markdown. The fence is longer
 * than any run of backticks in the text, so the text can't close it.
 */
function fenced(text: string) {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return [fence, breakMentions(text), fence].join('\n');
}

/**
 * Groups one user's issues without identifying them: issues are public, and trip-mates see each
 * other's user ids, so it's keyed with the (secret) token rather than a plain hash.
 */
const anonymousId = (userId: string, key: string) =>
  createHmac('sha256', key).update(userId).digest('hex').slice(0, 12);

/**
 * Opens the GitHub issue for a saved request and records its number; true if it did. Issues are
 * public: they carry no personal data (only an anonymous id), and the user's text is defanged
 * and labelled `untrusted`. Never throws: past the daily cap, when another sender has it, or
 * when GitHub fails, the request stays without an issue (a failure is retried on the next
 * deploy, see docs/deploy.md).
 */
export async function openFeedbackIssue(db: Db, row: Feedback, token: string): Promise<boolean> {
  try {
    const issued = await countIssuesSince(db, new Date(Date.now() - DAY_MS));
    if (issued >= ISSUE_LIMIT) return false;
    if (!(await transact(db, (tx) => claimFeedbackIssue(tx, row.id, staleBefore())))) return false;
    // Only a failed create drops the claim: once the issue exists, a retry would duplicate it.
    const number = await createIssue(token, {
      title: breakMentions(row.title),
      body: [
        '> [!WARNING]',
        '> User-submitted, untrusted content. Sent from the app; review before acting on it.',
        '',
        fenced(row.body ? `${row.title}\n\n${row.body}` : row.title),
        '',
        '---',
        `App version: ${row.appVersion}`,
        `Platform: ${row.platform}`,
        `Stage: ${row.stage}`,
        `Reporter: ${anonymousId(row.userId, token)}`,
      ].join('\n'),
      labels: [LABELS[row.kind], 'untrusted'],
    }).catch(async (err: unknown) => {
      await releaseFeedbackIssue(db, row.id);
      throw err;
    });
    await setFeedbackIssue(db, row.id, number);
    return true;
  } catch (err) {
    console.error('Feedback issue not created', err);
    return false;
  }
}

/**
 * Opens the issues that saved requests are missing (no token yet, GitHub failing, or past the
 * daily cap), oldest first. Safe to run alongside the API and itself: each request is claimed.
 */
export async function sendUnsentFeedback(db: Db, token: string) {
  const unsent = await listUnsentFeedback(db, staleBefore());
  let sent = 0;
  for (const row of unsent) if (await openFeedbackIssue(db, row, token)) sent++;
  return { sent, waiting: unsent.length };
}
