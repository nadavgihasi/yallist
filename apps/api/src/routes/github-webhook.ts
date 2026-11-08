import { createHmac, timingSafeEqual } from 'node:crypto';

import { Hono } from 'hono';

import type { Db } from '../db/client';
import { FEEDBACK_REPO } from '../github';
import {
  checksPassed,
  previewDeployed,
  prClosed,
  prOpened,
  type PipelineConfig,
} from '../pipeline';
import { reportError } from '../sentry';

/** Whether `signature` (X-Hub-Signature-256) is `sha256=` and the hex HMAC of the raw body. */
export function verifyGitHubSignature(body: string, signature: string | undefined, secret: string) {
  if (!signature?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(body, 'utf8').digest();
  const given = Buffer.from(signature.slice('sha256='.length), 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

type PullRequestEvent = {
  action: string;
  pull_request: {
    number: number;
    title: string;
    merged?: boolean;
    head: { ref: string; repo: { full_name: string } | null };
  };
};

type DeploymentStatusEvent = {
  deployment_status: {
    state: string;
    environment?: string;
    environment_url?: string;
    log_url?: string;
    target_url?: string;
  };
  deployment: { environment: string; ref: string };
  workflow_run?: { pull_requests?: { number: number }[] } | null;
};

type WorkflowRunEvent = {
  action: string;
  workflow_run: {
    name: string;
    conclusion: string | null;
    head_sha: string;
    head_repository: { full_name: string } | null;
    pull_requests: { number: number }[];
  };
};

/** The workflow that runs every PR check and ends in `all-pass` (.github/workflows/pr.yml). */
export const PR_WORKFLOW = 'PR';

/** A deployment's PR: from its workflow run, or a `refs/pull/<n>/…` ref. */
const deploymentPr = (event: DeploymentStatusEvent) =>
  event.workflow_run?.pull_requests?.[0]?.number ??
  Number(/^refs\/pull\/(\d+)\//.exec(event.deployment.ref)?.[1] ?? NaN);

/**
 * The repo webhook (events: Pull requests, Deployment statuses, Workflow runs; docs/deploy.md):
 * tells the pipeline chat when an approved request's PR opens or closes, when its preview is up,
 * and when its PR workflow passed (with Merge). It never acts on GitHub itself: merging takes a
 * press, and merges only the commit the offer named, so a forged event could at most send a
 * wrong message.
 */
export const githubWebhookRoutes = (db: Db, pipeline: PipelineConfig | null) =>
  new Hono().post('/', async (c) => {
    if (!pipeline?.githubSecret) return c.json({ error: 'Not found' }, 404);
    const body = await c.req.text();
    if (!verifyGitHubSignature(body, c.req.header('x-hub-signature-256'), pipeline.githubSecret)) {
      return c.json({ error: 'Bad signature' }, 401);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      return c.json({ error: 'Bad JSON' }, 400);
    }
    try {
      const event = c.req.header('x-github-event');
      if (event === 'pull_request') {
        const { action, pull_request: pr } = payload as PullRequestEvent;
        // Only branches of this repo: a fork's `claude/issue-…` branch isn't the routine's.
        if (pr.head.repo?.full_name === FEEDBACK_REPO) {
          if (action === 'opened' || action === 'reopened') {
            await prOpened(db, pipeline, {
              number: pr.number,
              title: pr.title,
              branch: pr.head.ref,
            });
          }
          if (action === 'closed') {
            await prClosed(db, pipeline, { number: pr.number, merged: !!pr.merged });
          }
        }
      }
      if (event === 'workflow_run') {
        const { action, workflow_run: run } = payload as WorkflowRunEvent;
        const pr = run.pull_requests[0]?.number;
        if (
          action === 'completed' &&
          run.name === PR_WORKFLOW &&
          run.conclusion === 'success' &&
          run.head_repository?.full_name === FEEDBACK_REPO &&
          pr
        ) {
          await checksPassed(db, pipeline, { pr, sha: run.head_sha });
        }
      }
      if (event === 'deployment_status') {
        const status = payload as DeploymentStatusEvent;
        const { state, environment_url, log_url, target_url } = status.deployment_status;
        const pr = deploymentPr(status);
        const done = ['success', 'failure', 'error'].includes(state);
        if (status.deployment.environment === 'preview' && done && pr) {
          await previewDeployed(db, pipeline, {
            pr,
            ok: state === 'success',
            url: environment_url,
            logUrl: log_url ?? target_url,
          });
        }
      }
    } catch (err) {
      console.error('GitHub webhook failed', err);
      await reportError(err, 'POST /webhooks/github');
      return c.json({ error: 'Failed' }, 500);
    }
    return c.body(null, 204);
  });
