import { randomUUID } from 'node:crypto';

import { RECEIPT_TYPES, type ReceiptStore } from './receipts';

/** Profile photos: JPEG, PNG or WebP of at most 5 MB. The app uploads a 512px JPEG. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AvatarType = (typeof AVATAR_TYPES)[number];

/** Every photo a user uploads lives under their own directory of the photos bucket. */
const avatarPrefix = (userId: string) => `avatars/${userId}/`;

export const newAvatarKey = (userId: string, type: AvatarType) =>
  `${avatarPrefix(userId)}${randomUUID()}.${RECEIPT_TYPES[type]}`;

/** `avatars/<userId>/<uuid>.<ext>`: only keys `newAvatarKey` hands out to this user. */
export const isOwnAvatarKey = (userId: string, key: string) => {
  const prefix = avatarPrefix(userId);
  const exts = AVATAR_TYPES.map((t) => RECEIPT_TYPES[t]).join('|');
  return (
    key.startsWith(prefix) &&
    new RegExp(`^[0-9a-f-]{36}\\.(${exts})$`).test(key.slice(prefix.length))
  );
};

/**
 * Google's profile picture at 256px: its URLs end in a size (`=s96-c`, too small for the
 * profile screen's 96pt on a 2x display).
 */
export const googlePhoto = (image: string) => image.replace(/=s\d+-c$/, '=s256-c');

/** What the user's avatar shows: their uploaded photo, else their Google picture, else none. */
export async function avatarUrl(
  store: ReceiptStore,
  { avatarKey, image }: { avatarKey: string | null; image: string | null | undefined },
) {
  if (avatarKey) return store.cachedViewUrl(avatarKey);
  return image ? googlePhoto(image) : undefined;
}
