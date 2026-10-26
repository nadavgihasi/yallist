import { describe, expect, it } from 'vitest';

import { googlePhoto, isOwnAvatarKey, newAvatarKey } from './avatars';
import { signingHour } from './receipts';

const USER = '0b6f3c1e-2f5d-4a7b-9c1e-3d2f5a7b9c1e';

describe('avatar keys', () => {
  it('puts a new photo under the user’s directory, with its type’s extension', () => {
    expect(newAvatarKey(USER, 'image/jpeg')).toMatch(
      new RegExp(`^avatars/${USER}/[0-9a-f-]{36}\\.jpg$`),
    );
    expect(newAvatarKey(USER, 'image/webp')).toMatch(/\.webp$/);
    expect(isOwnAvatarKey(USER, newAvatarKey(USER, 'image/png'))).toBe(true);
  });

  it.each([
    `avatars/${'1'.repeat(36)}/${'a'.repeat(36)}.jpg`,
    `avatars/${USER}/${'a'.repeat(36)}.heic`,
    `avatars/${USER}/${'a'.repeat(36)}.jpg/x`,
    `avatars/${USER}/../${'a'.repeat(36)}.jpg`,
    `avatars/${USER}/x.jpg`,
    `trips/${USER}/${'a'.repeat(36)}.jpg`,
  ])('rejects %s', (key) => {
    expect(isOwnAvatarKey(USER, key)).toBe(false);
  });
});

describe('googlePhoto', () => {
  it('asks Google for 256px', () => {
    expect(googlePhoto('https://lh3.googleusercontent.com/a/abc=s96-c')).toBe(
      'https://lh3.googleusercontent.com/a/abc=s256-c',
    );
  });

  it('leaves other URLs alone', () => {
    expect(googlePhoto('https://example.com/me.png')).toBe('https://example.com/me.png');
  });
});

describe('signingHour', () => {
  it('is the start of the hour, so links signed within it are the same', () => {
    const start = new Date('2026-10-26T10:00:00Z');
    expect(signingHour(new Date('2026-10-26T10:00:00Z'))).toEqual(start);
    expect(signingHour(new Date('2026-10-26T10:59:59.999Z'))).toEqual(start);
    expect(signingHour(new Date('2026-10-26T11:00:00Z'))).toEqual(new Date('2026-10-26T11:00:00Z'));
  });
});
