/** Where feedback from the app becomes issues. */
export const FEEDBACK_REPO = 'nadavgihasi/yallist';

/** Breaks @mentions (a zero-width space after the @), so text on GitHub can't ping anyone. */
export const breakMentions = (text: string) => text.replaceAll('@', '@​');

/**
 * Calls the REST API on FEEDBACK_REPO with a fine-grained token (Issues: read and write, nothing
 * else); `path` is under the repo. Throws on any failure.
 */
async function github<T>(token: string, method: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`https://api.github.com/repos/${FEEDBACK_REPO}${path}`, {
    method,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'yallist-api',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`GitHub ${method} ${path} failed: ${res.status}`);
  return (await res.json()) as T;
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

export const issueUrl = (issue: number) => `https://github.com/${FEEDBACK_REPO}/issues/${issue}`;
export const pullUrl = (pr: number) => `https://github.com/${FEEDBACK_REPO}/pull/${pr}`;
