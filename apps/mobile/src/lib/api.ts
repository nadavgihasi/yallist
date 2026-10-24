import type { AppType } from '@yallist/api/app';
import { DetailedError, hc } from 'hono/client';

/** Set at build time by SST (`infra/app/sst.config.ts`); locally, the dev API (`pnpm --filter @yallist/api dev`). */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

let token: string | undefined;
let onUnauthorized = () => {};

/** The session's bearer token, sent with every request; `handleUnauthorized` runs on a 401. */
export function setAuth(next: string | undefined, handleUnauthorized: () => void) {
  token = next;
  onUnauthorized = handleUnauthorized;
}

/** Typed client for the API; unwrap responses with `parseResponse` from `hono/client`. */
export const api = hc<AppType>(API_URL, {
  headers: (): Record<string, string> => (token ? { authorization: `Bearer ${token}` } : {}),
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await fetch(input, init);
    if (res.status === 401 && token) onUnauthorized();
    return res;
  },
});

/** The HTTP status of a failed API call; undefined for network errors. */
export const statusOf = (error: unknown): number | undefined =>
  error instanceof DetailedError ? error.statusCode : undefined;

export interface AuthResult {
  token: string;
  user: { id: string; name: string };
}

/**
 * Better Auth's endpoints (`/api/auth/*`), which the typed client doesn't cover. Sent with the
 * current session, if any: a guest who signs in with Google this way links the account (the
 * API moves the guest's trips to it).
 */
async function auth<T = AuthResult>(path: string, body: object): Promise<T> {
  const res = await fetch(`${API_URL}/api/auth${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new DetailedError(`${res.status}`, { statusCode: res.status });
  return (await res.json()) as T;
}

export const signInAsGuest = (name: string) => auth('/sign-in/anonymous', { name });

/** Exchanges a Google ID token (from Google Identity Services on web) for a session. */
export const signInWithGoogle = (idToken: string) =>
  auth('/sign-in/social', { provider: 'google', idToken: { token: idToken } });

/** Ends the session on the server. */
export const signOut = () => auth<unknown>('/sign-out', {});
