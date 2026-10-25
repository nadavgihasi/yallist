import { createHmac } from 'node:crypto';

import { Hono } from 'hono';
import { z } from 'zod';

import { fail, validate } from '../access';
import { requireUser, type Auth } from '../auth';
import {
  countFeedbackSince,
  countIssuesSince,
  insertFeedback,
  setFeedbackIssue,
} from '../dal/feedback';
import { lockProfile } from '../dal/profiles';
import type { Db } from '../db/client';
import { FEEDBACK_KINDS, PLATFORMS } from '../db/schema';
import { transact } from '../db/tx';
import { createIssue } from '../github';

export interface FeedbackConfig {
  /** The deployed stage, e.g. `dev`; recorded with each request. */
  stage: string;
  /** GitHub token for opening issues. Unset (or SST's `unset` placeholder): requests are only saved. */
  githubToken?: string;
}

/** Requests per user per hour. */
export const FEEDBACK_LIMIT = 5;
/** GitHub issues per day across all users; past it, requests are only saved. */
export const ISSUE_LIMIT = 50;
const HOUR_MS = 60 * 60 * 1000;

const LABELS = { feature: 'feature-request', bug: 'bug' } as const;

const feedbackRequest = z.strictObject({
  kind: z.enum(FEEDBACK_KINDS).default('feature'),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().max(4000).default(''),
  appVersion: z.string().trim().min(1).max(40),
  platform: z.enum(PLATFORMS),
});

/** Breaks @mentions (a zero-width space after the @), so an issue can't ping anyone. */
const breakMentions = (text: string) => text.replaceAll('@', '@\u200b');

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
 * Feature requests and bug reports from the app. Saved first; the GitHub issue is best effort,
 * so a GitHub outage, a missing token or the daily issue cap never fails the request. Issues are
 * public: they carry no personal data (only an anonymous id), and the user's text is defanged
 * and labelled `untrusted`.
 */
export const feedbackRoutes = (auth: Auth, db: Db, config: FeedbackConfig) => {
  const token = config.githubToken && config.githubToken !== 'unset' ? config.githubToken : null;

  return new Hono()
    .use(requireUser(auth))
    .post('/', validate('json', feedbackRequest), async (c) => {
      const userId = c.var.user.id;
      const input = c.req.valid('json');
      const row = await transact(db, async (tx) => {
        // Serializes a user's concurrent requests, so they can't all pass the count.
        await lockProfile(tx, userId);
        const recent = await countFeedbackSince(tx, userId, new Date(Date.now() - HOUR_MS));
        if (recent >= FEEDBACK_LIMIT) throw fail(429, 'Too many requests');
        return insertFeedback(tx, { ...input, userId, stage: config.stage });
      });

      if (token) {
        try {
          const issued = await countIssuesSince(db, new Date(Date.now() - 24 * HOUR_MS));
          if (issued >= ISSUE_LIMIT) return c.json({ id: row.id }, 201);
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
              `Reporter: ${anonymousId(userId, token)}`,
            ].join('\n'),
            labels: [LABELS[row.kind], 'untrusted'],
          });
          await setFeedbackIssue(db, row.id, number);
        } catch (err) {
          console.error('Feedback issue not created', err);
        }
      }
      return c.json({ id: row.id }, 201);
    });
};
