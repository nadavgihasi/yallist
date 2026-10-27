import { AVATAR_COLORS, parseIsraeliMobile } from '@yallist/domain';
import { Hono } from 'hono';
import { z } from 'zod';

import { fail, validate } from '../access';
import { requireUser, type Auth, type User } from '../auth';
import {
  AVATAR_MAX_BYTES,
  AVATAR_TYPES,
  avatarUrl,
  isOwnAvatarKey,
  newAvatarKey,
} from '../avatars';
import { listEssentials, MAX_ESSENTIALS, pastPrivateNames, setEssentials } from '../dal/essentials';
import { findProfile, lockProfile, updateProfile } from '../dal/profiles';
import type { Db } from '../db/client';
import type { profiles } from '../db/schema';
import { transact } from '../db/tx';
import { deleteReceipt, type ReceiptStore } from '../receipts';

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

/**
 * The profile as the app shows it, with how the user signed in. `avatarUrl` is their photo, else
 * their Google picture; `customAvatar` says it's a photo they can remove.
 */
async function toMe(profile: typeof profiles.$inferSelect, user: User, photos: ReceiptStore) {
  const { createdAt: _c, updatedAt: _u, avatarKey, ...fields } = profile;
  return {
    ...fields,
    avatarUrl: (await avatarUrl(photos, { avatarKey, image: user.image })) ?? null,
    customAvatar: avatarKey !== null,
    account: user.isAnonymous
      ? { type: 'guest' as const, email: null }
      : { type: 'google' as const, email: user.email },
  };
}

/** Sets the user's photo (or none); returns the profile and the photo it replaced. */
const setAvatar = (db: Db, userId: string, avatarKey: string | null) =>
  transact(db, async (tx) => {
    await lockProfile(tx, userId);
    const old = (await findProfile(tx, userId))?.avatarKey;
    const profile = await updateProfile(tx, userId, { avatarKey });
    if (!profile) throw fail(404, 'Not found');
    return { profile, replaced: old !== avatarKey ? old : null };
  });

/**
 * The signed-in user's own profile. Renaming changes the name for trips joined from now on;
 * the name in trips already joined (trip_members.display_name, editable per trip) stays.
 */
export const meRoutes = (auth: Auth, db: Db, photos: ReceiptStore) =>
  new Hono()
    .use(requireUser(auth))

    .get('/', async (c) => {
      const profile = await findProfile(db, c.var.user.id);
      if (!profile) throw fail(404, 'Not found');
      return c.json(await toMe(profile, c.var.user, photos));
    })

    // הקבועים שלי, and the names of my private items so far (what "אולי גם" suggests from).
    .get('/essentials', async (c) => {
      const me = c.var.user.id;
      const [essentials, pastItems] = await Promise.all([
        listEssentials(db, me),
        pastPrivateNames(db, me),
      ]);
      return c.json({ essentials, pastItems });
    })

    // set_essentials: the whole list, in order. Trips I'm already in keep what they have.
    .put(
      '/essentials',
      validate(
        'json',
        z.object({
          names: z.array(z.string().trim().min(1).max(60)).max(MAX_ESSENTIALS),
        }),
      ),
      async (c) => {
        const { names } = c.req.valid('json');
        const essentials = await transact(db, (tx) => setEssentials(tx, c.var.user.id, names));
        return c.json({ essentials });
      },
    )

    .patch('/', validate('json', profileChanges), async (c) => {
      const profile = await updateProfile(db, c.var.user.id, c.req.valid('json'));
      if (!profile) throw fail(404, 'Not found');
      return c.json(await toMe(profile, c.var.user, photos));
    })

    // Where and how to upload a new photo, under the user's own directory of the private
    // photos bucket. The form's policy enforces the type and the size limit.
    .post(
      '/avatar/upload-url',
      validate(
        'json',
        z.object({ contentType: z.enum(AVATAR_TYPES), size: z.int().min(1).max(AVATAR_MAX_BYTES) }),
      ),
      async (c) => {
        const { contentType } = c.req.valid('json');
        const key = newAvatarKey(c.var.user.id, contentType);
        return c.json({ key, ...(await photos.uploadForm(key, contentType, AVATAR_MAX_BYTES)) });
      },
    )

    // The upload finished: it becomes the user's photo, and the one it replaces is deleted.
    .post('/avatar', validate('json', z.object({ key: z.string().max(200) })), async (c) => {
      const { key } = c.req.valid('json');
      const user = c.var.user;
      if (!isOwnAvatarKey(user.id, key)) throw fail(400, 'Not a photo key of this user');
      const stored = await photos.head(key);
      if (!stored) throw fail(400, 'Not uploaded');
      if (
        stored.size > AVATAR_MAX_BYTES ||
        !(AVATAR_TYPES as readonly string[]).includes(stored.contentType)
      ) {
        throw fail(400, 'Not a JPEG, PNG or WebP of at most 5 MB');
      }
      const { profile, replaced } = await setAvatar(db, user.id, key);
      if (replaced) await deleteReceipt(photos, replaced);
      return c.json(await toMe(profile, user, photos));
    })

    // Back to the Google picture, or the initial.
    .delete('/avatar', async (c) => {
      const user = c.var.user;
      const { profile, replaced } = await setAvatar(db, user.id, null);
      if (replaced) await deleteReceipt(photos, replaced);
      return c.json(await toMe(profile, user, photos));
    });
