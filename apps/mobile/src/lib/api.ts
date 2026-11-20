import type { AppType } from '@yallist/api/app';
import { DetailedError, hc } from 'hono/client';
import { Platform } from 'react-native';

import { CLIENT_HEADER, CLIENT_ID } from './realtime';

/** Set at build time by SST (`infra/app/core.ts`); locally, the dev API (`pnpm --filter @yallist/api dev`). */
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

let token: string | undefined;
let onUnauthorized = () => {};

/** The session's bearer token, sent with every request; `handleUnauthorized` runs on a 401. */
export function setAuth(next: string | undefined, handleUnauthorized: () => void) {
  token = next;
  onUnauthorized = handleUnauthorized;
}

/** The session's bearer token, which the realtime connection authorizes with too. */
export const sessionToken = () => token;

/**
 * Typed client for the API; unwrap responses with `parseResponse` from `hono/client`. Signed-in
 * requests name this app session too, so the realtime events of its own changes come back marked
 * (lib/realtime.ts `isOwnEvent`). Only with the token: those already need a CORS preflight.
 */
export const api = hc<AppType>(API_URL, {
  headers: (): Record<string, string> =>
    token ? { authorization: `Bearer ${token}`, [CLIENT_HEADER]: CLIENT_ID } : {},
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
 * Android's HTTP client keeps the session cookie Better Auth sets, and Better Auth refuses a
 * request that carries a cookie but no Origin (403 MISSING_OR_NULL_ORIGIN): after the first
 * sign-in, signing out or in with Google failed. The app's scheme is a trusted origin
 * (apps/api/src/auth.ts). Browsers send their own Origin.
 */
const NATIVE_ORIGIN: Record<string, string> = Platform.OS === 'web' ? {} : { origin: 'yallist://' };

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
      ...NATIVE_ORIGIN,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new DetailedError(`${res.status}`, { statusCode: res.status });
  return (await res.json()) as T;
}

export const signInAsGuest = (name: string) => auth('/sign-in/anonymous', { name });

/** Exchanges a Google ID token (Google Identity Services on web, the account picker on Android) for a session. */
export const signInWithGoogle = (idToken: string) =>
  auth('/sign-in/social', { provider: 'google', idToken: { token: idToken } });

/** Ends the session on the server. */
export const signOut = () => auth<unknown>('/sign-out', {});
