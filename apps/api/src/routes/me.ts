import { AVATAR_COLORS, parseIsraeliMobile } from '@yallist/domain';
import { Hono } from 'hono';
import { z } from 'zod';

import { fail, validate } from '../access';
import { requireUser, type Auth, type User } from '../auth';
import { findProfile, updateProfile } from '../dal/profiles';
import type { Db } from '../db/client';
import type { profiles } from '../db/schema';

/** Empty clears the phone; anything else must be an Israeli mobile, stored in E.164. */
const paymentPhone = z
  .string()
  .trim()
  .transform((text, ctx) => {
    if (!text) return null;
    const phone = parseIsraeliMobile(text);
    if (!phone) ctx.addIssue({ code: 'custom', message: 'Not an Israeli mobile number' });
    return phone ?? z.NEVER;
  })
  .nullable();

const profileChanges = z.strictObject({
  displayName: z.string().trim().min(1).max(50).optional(),
  avatarColor: z.enum(AVATAR_COLORS).optional(),
  paymentPhone: paymentPhone.optional(),
  notifyUpdates: z.boolean().optional(),
  notifyDayBefore: z.boolean().optional(),
  notifySettle: z.boolean().optional(),
});

/** The profile as the app shows it, with how the user signed in. */
function toMe(profile: typeof profiles.$inferSelect, user: User) {
  const { createdAt: _c, updatedAt: _u, ...fields } = profile;
  return {
    ...fields,
    account: user.isAnonymous
      ? { type: 'guest' as const, email: null }
      : { type: 'google' as const, email: user.email },
  };
}

/**
 * The signed-in user's own profile. Renaming changes the name for trips joined from now on;
 * the name in trips already joined (trip_members.display_name, editable per trip) stays.
 */
export const meRoutes = (auth: Auth, db: Db) =>
  new Hono()
    .use(requireUser(auth))

    .get('/', async (c) => {
      const profile = await findProfile(db, c.var.user.id);
      if (!profile) throw fail(404, 'Not found');
      return c.json(toMe(profile, c.var.user));
    })

    .patch('/', validate('json', profileChanges), async (c) => {
      const profile = await updateProfile(db, c.var.user.id, c.req.valid('json'));
      if (!profile) throw fail(404, 'Not found');
      return c.json(toMe(profile, c.var.user));
    });
