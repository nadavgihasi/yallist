import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { anonymous } from 'better-auth/plugins/anonymous';
import { bearer } from 'better-auth/plugins/bearer';
import { createMiddleware } from 'hono/factory';

import { insertProfile, mergeUser } from './dal/profiles';
import type { Db } from './db/client';
import * as schema from './db/schema';

export { mergeUser };

/** SPEC §9 avatar palette (also apps/mobile's theme). */
const AVATAR_COLORS = ['#FFD9C2', '#D8F0E0', '#F1DDF7', '#FFF0B3', '#D3F1F4', '#FFDDE4', '#E3E0FF'];

export interface AuthConfig {
  /** The API's public URL; Better Auth is served under `/api/auth`. */
  baseURL: string;
  /** The web app, trusted as an origin. Not needed where sessions are only looked up. */
  webURL?: string;
  secret: string;
  google: { clientId: string; clientSecret: string };
}

/**
 * Better Auth with guest (anonymous) and Google sign-in. Clients send the session token as
 * `Authorization: Bearer`: the API and the web app are on different domains, and Android has no
 * cookie jar. Every user gets a `profiles` row when they're created.
 */
export function createAuth(db: Db, config: AuthConfig) {
  return betterAuth({
    baseURL: config.baseURL,
    secret: config.secret,
    // The web app, the Expo dev server, and the native app's deep links (OAuth redirects back).
    trustedOrigins: [
      ...(config.webURL ? [config.webURL] : []),
      'http://localhost:8081',
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
        onLinkAccount: ({ anonymousUser, newUser }) =>
          mergeUser(db, anonymousUser.user.id, newUser.user.id),
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
