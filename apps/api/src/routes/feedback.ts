import { Hono } from 'hono';
import { z } from 'zod';

import { fail, validate } from '../access';
import { requireUser, type Auth } from '../auth';
import { countFeedbackSince, insertFeedback } from '../dal/feedback';
import { lockProfile } from '../dal/profiles';
import type { Db } from '../db/client';
import { FEEDBACK_KINDS, PLATFORMS } from '../db/schema';
import { transact } from '../db/tx';
import { feedbackToken, openFeedbackIssue } from '../feedback-issue';

export interface FeedbackConfig {
  /** The deployed stage, e.g. `dev`; recorded with each request. */
  stage: string;
  /** GitHub token for opening issues. Unset (or SST's `unset` placeholder): requests are only saved. */
  githubToken?: string;
}

/** Requests per user per hour. */
export const FEEDBACK_LIMIT = 5;
const HOUR_MS = 60 * 60 * 1000;

const feedbackRequest = z.strictObject({
  kind: z.enum(FEEDBACK_KINDS).default('feature'),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().max(4000).default(''),
  appVersion: z.string().trim().min(1).max(40),
  platform: z.enum(PLATFORMS),
});

/**
 * Feature requests and bug reports from the app. Saved first; the GitHub issue
 * (openFeedbackIssue) is best effort, so a GitHub outage, a missing token or the daily issue cap
 * never fails the request.
 */
export const feedbackRoutes = (auth: Auth, db: Db, config: FeedbackConfig) => {
  const token = feedbackToken(config.githubToken);

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

      if (token) await openFeedbackIssue(db, row, token);
      return c.json({ id: row.id }, 201);
    });
};
