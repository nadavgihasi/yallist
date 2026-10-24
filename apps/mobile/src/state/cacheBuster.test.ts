import { describe, expect, it } from 'vitest';

import { CACHE_VERSION, cacheBuster } from './cacheBuster';

describe('cacheBuster', () => {
  it('keys the cache on the build commit', () => {
    expect(cacheBuster('9e51fa8')).toBe('9e51fa8');
  });

  it('falls back to the manual version without one', () => {
    expect(cacheBuster(undefined)).toBe(`v${CACHE_VERSION}`);
    expect(cacheBuster('')).toBe(`v${CACHE_VERSION}`);
  });
});
