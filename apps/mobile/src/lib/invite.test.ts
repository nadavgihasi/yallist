import { describe, expect, it } from 'vitest';

import { invitePayload, inviteUrl, whoIsIn } from './invite';

describe('inviteUrl', () => {
  it('builds an https link to the join page', () => {
    expect(inviteUrl('https://d14dyw021evejd.cloudfront.net', 'abc123')).toBe(
      'https://d14dyw021evejd.cloudfront.net/j/abc123',
    );
  });

  it('ignores a trailing slash on the origin', () => {
    expect(inviteUrl('https://yallist.example/', 'abc')).toBe('https://yallist.example/j/abc');
  });

  it('keeps the local dev origin', () => {
    expect(inviteUrl('http://localhost:8081', 'abc')).toBe('http://localhost:8081/j/abc');
  });

  it('escapes the token', () => {
    expect(inviteUrl('https://yallist.example', 'a/b?c')).toBe(
      'https://yallist.example/j/a%2Fb%3Fc',
    );
  });
});

describe('invitePayload', () => {
  const url = 'https://yallist.example/j/abc';
  // What the receiving app shows: share targets join the text and the url.
  const shared = (p: { message?: string; url?: string }) =>
    [p.message, p.url].filter(Boolean).join(' ');

  it('shares exactly the previewed message, with its link once', () => {
    const message = `בואו לטיול! ${url}`;
    expect(shared(invitePayload(message))).toBe(message);
    expect(shared(invitePayload(message)).split(url)).toHaveLength(2);
  });
});

describe('whoIsIn', () => {
  it('names up to three, and counts the rest', () => {
    expect(whoIsIn(['דנה'], 1)).toBe('דנה כבר בטיול');
    expect(whoIsIn(['דנה', 'רון'], 2)).toBe('דנה ורון כבר בטיול');
    expect(whoIsIn(['דנה', 'רון', 'שירה'], 3)).toBe('דנה, רון ושירה כבר בטיול');
    expect(whoIsIn(['דנה', 'רון', 'שירה', 'אבי'], 4)).toBe('דנה, רון ועוד 2 כבר בטיול');
  });

  it('counts members the preview leaves out', () => {
    expect(whoIsIn(['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח'], 12)).toBe('א, ב ועוד 10 כבר בטיול');
    expect(whoIsIn([], 0)).toBe('');
  });
});
