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
});
