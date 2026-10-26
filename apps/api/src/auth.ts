import { AVATAR_COLORS } from '@yallist/domain';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { anonymous } from 'better-auth/plugins/anonymous';
import { bearer } from 'better-auth/plugins/bearer';
import { createMiddleware } from 'hono/factory';

import { insertProfile, mergeUser } from './dal/profiles';
import type { Db } from './db/client';
import * as schema from './db/schema';
import { deleteReceipt, type ReceiptStore } from './receipts';

export { mergeUser };

export interface AuthConfig {
  /**
   * The API's public URL, with the path it's served under if any (a PR preview's `/pr-123`).
   * Better Auth is served under `<baseURL>/api/auth`.
   */
  baseURL: string;
  /**
   * The web app, whose origin is trusted. Not needed where sessions are only looked up. A PR
   * preview's site is under a path; origins never have one.
   */
  webURL?: string;
  /** Trust the local Expo dev server (http://localhost:8081), for running it against a deployed API. */
  devServer?: boolean;
  secret: string;
  google: { clientId: string; clientSecret: string };
  /** The photos bucket, for deleting a guest's photo the account replaces. Where accounts are linked. */
  photos?: ReceiptStore;
}

/**
 * Better Auth with guest (anonymous) and Google sign-in. Clients send the session token as
 * `Authorization: Bearer`: the API and the web app are on different domains, and Android has no
 * cookie jar. Every user gets a `profiles` row when they're created.
 */
export function createAuth(db: Db, config: AuthConfig) {
  return betterAuth({
    // A path in `baseURL` replaces Better Auth's `basePath`, so it must end in its `/api/auth`.
    baseURL: `${config.baseURL}/api/auth`,
    secret: config.secret,
    // The web app, the Expo dev server, and the native app's deep links (OAuth redirects back).
    trustedOrigins: [
      ...(config.webURL ? [new URL(config.webURL).origin] : []),
      ...(config.devServer ? ['http://localhost:8081'] : []),
      'yallist://',
    ],
    database: drizzleAdapter(db, { provider: 'pg', schema, usePlural: true }),
    advanced: { database: { generateId: 'uuid' } },
    socialProviders: { google: config.google },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await insertProfile(db, {
              id: user.id,
              displayName: user.name,
              avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!,
            });
          },
        },
      },
    },
    plugins: [
      anonymous({
        // POST /api/auth/sign-in/anonymous { name }
        generateName: (ctx) => {
          const name: unknown = ctx.body?.name;
          return typeof name === 'string' && name.trim() ? name.trim().slice(0, 50) : 'אורח';
        },
        // A guest who signs in with Google keeps their trips; the guest user is then deleted.
        onLinkAccount: async ({ anonymousUser, newUser }) => {
          const replaced = await mergeUser(db, anonymousUser.user.id, newUser.user.id);
          if (replaced && config.photos) await deleteReceipt(config.photos, replaced);
        },
      }),
      bearer(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type User = Auth['$Infer']['Session']['user'];

/** Rejects requests without a valid session with 401; otherwise sets `c.var.user`. */
export const requireUser = (auth: Auth) =>
  createMiddleware<{ Variables: { user: User } }>(async (c, next) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: 'Unauthorized' }, 401);
    c.set('user', session.user);
    await next();
  });
