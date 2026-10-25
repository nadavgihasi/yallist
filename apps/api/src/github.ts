/** Where feedback from the app becomes issues. */
export const FEEDBACK_REPO = 'nadavgihasi/yallist';

/**
 * Opens an issue with a fine-grained token (Issues: read and write on FEEDBACK_REPO); returns its
 * number. Throws on any failure.
 */
export async function createIssue(
  token: string,
  issue: { title: string; body: string; labels: string[] },
): Promise<number> {
  const res = await fetch(`https://api.github.com/repos/${FEEDBACK_REPO}/issues`, {
    method: 'POST',
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'yallist-api',
      'x-github-api-version': '2022-11-28',
    },
    body: JSON.stringify(issue),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`GitHub issue creation failed: ${res.status}`);
  const { number } = (await res.json()) as { number: number };
  return number;
}
