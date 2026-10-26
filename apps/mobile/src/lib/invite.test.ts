import { describe, expect, it } from 'vitest';

import { inviteUrl } from './invite';

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
