import { describe, expect, it } from 'vitest';

import { parseAlbumUrl, isMeetupPlace, parseMapLink, meetupLinks } from './links';

describe('meetupLinks', () => {
  it('searches a place in Waze and in Google Maps', () => {
    expect(meetupLinks(' Ein Gedi & beach ')).toEqual({
      waze: 'https://waze.com/ul?q=Ein%20Gedi%20%26%20beach&navigate=yes',
      maps: 'https://www.google.com/maps/search/?api=1&query=Ein%20Gedi%20%26%20beach',
    });
    const { waze } = meetupLinks('חניון עין גדי') as { waze: string };
    expect(new URL(waze).searchParams.get('q')).toBe('חניון עין גדי');
  });

  it('opens a pasted map link as is', () => {
    const link = 'https://maps.app.goo.gl/AbC123';
    expect(meetupLinks(` ${link} `)).toEqual({ link });
  });

  it('searches for text that only mentions a link', () => {
    expect(meetupLinks('javascript:alert(1)')).toHaveProperty('waze');
  });
});

describe('parseMapLink', () => {
  it.each([
    'https://waze.com/ul?ll=31.4,35.3&navigate=yes',
    'https://www.waze.com/ul/hsv8wr',
    'https://ul.waze.com/ul?place=abc',
    'https://www.google.com/maps/place/Ein+Gedi',
    'https://google.com/maps?q=31.4,35.3',
    'https://WWW.Google.com/maps',
    'https://maps.app.goo.gl/AbC123',
    'https://goo.gl/maps/AbC123',
  ])('accepts %s', (url) => expect(parseMapLink(url)).toBe(url));

  it.each([
    'http://waze.com/ul?q=x',
    'https://waze.com.evil.example/ul',
    'https://evilwaze.com/ul',
    'https://www.google.com/search?q=maps',
    'https://www.google.com/mapsfoo',
    'https://goo.gl/AbC123',
    'https://user@waze.com/ul',
    'https://waze.com:8443/ul',
    'https://waze.com/ul?q=a b',
    'javascript:alert(1)//https://waze.com',
    'waze.com/ul?q=x',
    '',
  ])('rejects %s', (url) => expect(parseMapLink(url)).toBeUndefined());
});

describe('parseAlbumUrl', () => {
  it.each([
    'https://photos.app.goo.gl/AbC123xyz',
    'https://photos.google.com/share/AF1Qip?key=abc',
  ])('accepts %s', (url) => expect(parseAlbumUrl(url)).toBe(url));

  it.each([
    'http://photos.app.goo.gl/AbC123',
    'https://photos.google.com.evil.example/share',
    'https://drive.google.com/drive/folders/abc',
    'https://maps.app.goo.gl/AbC123',
    'photos.app.goo.gl/AbC123',
  ])('rejects %s', (url) => expect(parseAlbumUrl(url)).toBeUndefined());
});

describe('isMeetupPlace', () => {
  it.each(['חניון הר הכרמל', 'Ein Gedi: parking', 'https://maps.app.goo.gl/AbC123'])(
    'accepts %s',
    (text) => expect(isMeetupPlace(text)).toBe(true),
  );

  it.each(['', '   ', 'https://example.com/place', 'http://waze.com/ul?q=x'])(
    'rejects %s',
    (text) => expect(isMeetupPlace(text)).toBe(false),
  );
});
