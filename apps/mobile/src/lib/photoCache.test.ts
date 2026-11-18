import { describe, expect, it } from 'vitest';

import { photoCacheKey, photoFileName, photosToEvict } from './photoCache';

describe('photoCacheKey', () => {
  it('drops the signature, so a re-signed link is the same photo', () => {
    const key = 'https://b.s3.eu-central-1.amazonaws.com/avatars/u1/0a1b.jpg';
    expect(photoCacheKey(`${key}?X-Amz-Date=20261118T100000Z&X-Amz-Signature=aa`)).toBe(key);
    expect(photoCacheKey(`${key}?X-Amz-Date=20261118T110000Z&X-Amz-Signature=bb`)).toBe(key);
  });

  it('keeps the path, which names the photo', () => {
    expect(photoCacheKey('https://lh3.googleusercontent.com/a/abc=s256-c')).toBe(
      'https://lh3.googleusercontent.com/a/abc=s256-c',
    );
    expect(photoCacheKey('http://localhost:8787/view/avatars/u1/a.jpg')).toBe(
      'http://localhost:8787/view/avatars/u1/a.jpg',
    );
  });

  it('keeps nothing that is not a web link', () => {
    expect(photoCacheKey('file:///data/photo.jpg')).toBeUndefined();
    expect(photoCacheKey('blob:https://yallist.app/123')).toBeUndefined();
    expect(photoCacheKey('not a url')).toBeUndefined();
  });
});

describe('photoFileName', () => {
  it('is stable, distinct per photo, and keeps the extension', () => {
    const a = photoFileName('https://b.s3.amazonaws.com/avatars/u1/a.jpg');
    expect(a).toMatch(/^[0-9a-f]{16}\.jpg$/);
    expect(photoFileName('https://b.s3.amazonaws.com/avatars/u1/a.jpg')).toBe(a);
    expect(photoFileName('https://b.s3.amazonaws.com/avatars/u1/b.jpg')).not.toBe(a);
    expect(photoFileName('https://lh3.googleusercontent.com/a/abc=s256-c')).toMatch(
      /^[0-9a-f]{16}$/,
    );
  });
});

describe('photosToEvict', () => {
  it('removes the longest kept beyond the limit', () => {
    const photos = [
      { name: 'a', savedAt: 3 },
      { name: 'b', savedAt: 1 },
      { name: 'c', savedAt: 2 },
    ];
    expect(photosToEvict(photos, 3)).toEqual([]);
    expect(photosToEvict(photos, 1).map((p) => p.name)).toEqual(['b', 'c']);
  });
});
