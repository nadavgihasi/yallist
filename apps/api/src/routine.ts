/** The feature implementer routine's API trigger: its id (`trig_…`) and the token generated for it. */
export type Routine = { id: string; token: string };

/** A failed fire, with what Telegram should show (never the token). */
export class FireError extends Error {}

/**
 * Starts a session of the routine with `text` (≤ 65,536 characters, received wrapped as an
 * untrusted `<routine-fire-payload>`); returns the session's URL. Not idempotent: every call that
 * succeeds is another session, so callers claim the request first. Throws FireError on any
 * failure, including a timeout, after which a session may still have started.
 * https://platform.claude.com/docs/en/api/claude-code/routines-fire
 */
export async function fireRoutine(routine: Routine, text: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`https://api.anthropic.com/v1/claude_code/routines/${routine.id}/fire`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${routine.token}`,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'experimental-cc-routine-2026-04-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ text: text.slice(0, 65_536) }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new FireError(`no answer (${(err as Error).name}); a session may have started`);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    const retry = res.headers.get('retry-after');
    throw new FireError(
      [res.status, body?.error?.message, retry && `retry after ${retry}s`]
        .filter(Boolean)
        .join(' · '),
    );
  }
  const { claude_code_session_url: url } = (await res.json()) as {
    claude_code_session_url: string;
  };
  return url;
}
