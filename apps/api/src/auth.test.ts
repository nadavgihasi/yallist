import { describe, expect, it } from 'vitest';

import { createAuth } from './auth';
import type { Db } from './db/client';

const config = {
  baseURL: 'https://api.example.com',
  webURL: 'https://app.example.com',
  secret: 'test-secret-at-least-32-characters-long',
  google: { clientId: 'test', clientSecret: 'test' },
};

describe('trustedOrigins', () => {
  // No database access: the options are read, no request is made.
  const db = {} as Db;

  it('trusts the local dev server only when asked (not in production)', () => {
    expect(createAuth(db, config).options.trustedOrigins).toEqual([
      'https://app.example.com',
      'yallist://',
    ]);
    expect(createAuth(db, { ...config, devServer: true }).options.trustedOrigins).toContain(
      'http://localhost:8081',
    );
  });

  // A PR preview's site is under a path (/pr-123); Better Auth compares bare origins.
  it('trusts the origin of a web URL with a path', () => {
    expect(
      createAuth(db, { ...config, webURL: 'https://d1234.cloudfront.net/pr-123' }).options
        .trustedOrigins,
    ).toContain('https://d1234.cloudfront.net');
  });
});

describe('baseURL', () => {
  const db = {} as Db;

  it('serves Better Auth under /api/auth of the API URL, with or without a path', () => {
    expect(createAuth(db, config).options.baseURL).toBe('https://api.example.com/api/auth');
    expect(
      createAuth(db, { ...config, baseURL: 'https://api.example.com/pr-123' }).options.baseURL,
    ).toBe('https://api.example.com/pr-123/api/auth');
  });
});
