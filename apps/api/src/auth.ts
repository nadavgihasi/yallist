import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { anonymous } from 'better-auth/plugins/anonymous';
import { bearer } from 'better-auth/plugins/bearer';
import { eq, sql } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';

import type { Db } from './db/client';
import * as schema from './db/schema';

/** SPEC §9 avatar palette (also apps/mobile's theme). */
const AVATAR_COLORS = ['#FFD9C2', '#D8F0E0', '#F1DDF7', '#FFF0B3', '#D3F1F4', '#FFDDE4', '#E3E0FF'];

export interface AuthConfig {
  /** The API's public URL; Better Auth is served under `/api/auth`. */
  baseURL: string;
  webURL: string;
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
    trustedOrigins: [config.webURL, 'http://localhost:8081', 'yallist://'],
    database: drizzleAdapter(db, { provider: 'pg', schema, usePlural: true }),
    advanced: { database: { generateId: 'uuid' } },
    socialProviders: { google: config.google },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await db.insert(schema.profiles).values({
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

/** Tables keyed by (something, user_id): where both users have a row, the account's wins. */
const USER_KEYED = [
  ['trip_members', 'trip_id'],
  ['claims', 'item_id'],
  ['expense_shares', 'expense_id'],
] as const;

/** Every column that references a profile. */
const USER_COLUMNS = [
  ['trips', 'created_by'],
  ['trip_members', 'user_id'],
  ['items', 'created_by'],
  ['claims', 'user_id'],
  ['expenses', 'paid_by'],
  ['expenses', 'created_by'],
  ['expense_shares', 'user_id'],
  ['payments', 'from_user'],
  ['payments', 'to_user'],
  ['activity', 'actor'],
] as const;

/** Moves everything of user `from` to user `to` and deletes `from`'s profile. */
export async function mergeUser(db: Db, from: string, to: string) {
  const id = sql.identifier;
  await db.transaction(async (tx) => {
    // Where both are in a trip, the account keeps the stronger membership, so a trip never
    // loses its organizer: organizer beats member, and active beats pending beats removed.
    await tx.execute(sql`
      update trip_members b set
        role = case when a.role = 'organizer' then a.role else b.role end,
        status = case
          when a.status = 'active' or (a.status = 'pending' and b.status = 'removed') then a.status
          else b.status end
      from trip_members a
      where a.trip_id = b.trip_id and a.user_id = ${from} and b.user_id = ${to}`);
    for (const [table, key] of USER_KEYED) {
      await tx.execute(sql`
        delete from ${id(table)} a where a.user_id = ${from} and exists (
          select 1 from ${id(table)} b where b.${id(key)} = a.${id(key)} and b.user_id = ${to})`);
    }
    for (const [table, column] of USER_COLUMNS) {
      await tx.execute(
        sql`update ${id(table)} set ${id(column)} = ${to} where ${id(column)} = ${from}`,
      );
    }
    await tx.delete(schema.profiles).where(eq(schema.profiles.id, from));
  });
}
