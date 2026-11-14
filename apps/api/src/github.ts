/** Where feedback from the app becomes issues. */
export const FEEDBACK_REPO = 'nadavgihasi/yallist';

/** Breaks @mentions (a zero-width space after the @), so text on GitHub can't ping anyone. */
export const breakMentions = (text: string) => text.replaceAll('@', '@​');

/** A failed GitHub call, with GitHub's own message (e.g. why a merge was refused). */
export class GitHubError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
    context: string,
  ) {
    super(`${context} failed: ${status}${reason ? ` ${reason}` : ''}`);
  }
}

/**
 * Calls the REST API on FEEDBACK_REPO with a fine-grained token (the feedback token: Issues only;
 * the merge token: Contents and Pull requests); `path` is under the repo. Throws GitHubError on
 * any failure.
 */
async function github<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://api.github.com/repos/${FEEDBACK_REPO}${path}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'yallist-api',
      'x-github-api-version': '2022-11-28',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const reason = ((await res.json().catch(() => null)) as { message?: string } | null)?.message;
    throw new GitHubError(res.status, reason ?? '', `GitHub ${method} ${path}`);
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

/** Opens an issue; returns its number. */
export async function createIssue(
  token: string,
  issue: { title: string; body: string; labels: string[] },
): Promise<number> {
  const { number } = await github<{ number: number }>(token, 'POST', '/issues', issue);
  return number;
}

export async function commentOnIssue(token: string, issue: number, body: string) {
  await github(token, 'POST', `/issues/${issue}/comments`, { body });
}

/** Closes an issue as not planned. */
export async function closeIssue(token: string, issue: number) {
  await github(token, 'PATCH', `/issues/${issue}`, {
    state: 'closed',
    state_reason: 'not_planned',
  });
}

/** A PR's state as merging needs it. */
export async function getPull(token: string, pr: number) {
  const pull = await github<{
    state: string;
    draft: boolean;
    title: string;
    head: { sha: string; ref: string };
  }>(token, 'GET', `/pulls/${pr}`);
  return pull;
}

/**
 * Squash-merges a PR, only if its head is still `sha` (GitHub refuses otherwise, and when the
 * branch rules aren't met). Throws GitHubError with GitHub's reason.
 */
export async function mergePull(token: string, pr: number, sha: string, title: string) {
  await github(token, 'PUT', `/pulls/${pr}/merge`, {
    sha,
    merge_method: 'squash',
    commit_title: `${title} (#${pr})`,
  });
}

/** Marks a draft PR ready for review (GraphQL only; the REST API can't). */
export async function markReady(token: string, pr: number) {
  const { node_id } = await github<{ node_id: string }>(token, 'GET', `/pulls/${pr}`);
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'yallist-api',
    },
    body: JSON.stringify({
      query:
        'mutation($id: ID!) { markPullRequestReadyForReview(input: { pullRequestId: $id }) { clientMutationId } }',
      variables: { id: node_id },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const result = (await res.json().catch(() => null)) as { errors?: { message: string }[] } | null;
  if (!res.ok || result?.errors?.length) {
    throw new GitHubError(res.status, result?.errors?.[0]?.message ?? '', 'GitHub mark ready');
  }
}

/** Deletes a branch (after its PR merged). */
export async function deleteBranch(token: string, branch: string) {
  await github(
    token,
    'DELETE',
    `/git/refs/heads/${branch.split('/').map(encodeURIComponent).join('/')}`,
  );
}

export const issueUrl = (issue: number) => `https://github.com/${FEEDBACK_REPO}/issues/${issue}`;
export const pullUrl = (pr: number) => `https://github.com/${FEEDBACK_REPO}/pull/${pr}`;
