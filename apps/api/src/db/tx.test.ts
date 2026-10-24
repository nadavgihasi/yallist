import { describe, expect, it, vi } from 'vitest';

import { isRetryable, withRetry } from './tx';

/** What postgres.js throws for a DSQL write conflict, wrapped the way Drizzle wraps it. */
function conflict() {
  const cause = Object.assign(
    new Error('change conflicts with another transaction, please retry: (OC000)'),
    { code: '40001' },
  );
  return new Error('Failed query: update ...', { cause });
}

describe('isRetryable', () => {
  it('spots write conflicts anywhere in the cause chain', () => {
    expect(isRetryable(conflict())).toBe(true);
    expect(isRetryable(Object.assign(new Error('x'), { code: '40001' }))).toBe(true);
    expect(isRetryable(new Error('schema has been updated by another transaction (OC001)'))).toBe(
      true,
    );
  });

  it('leaves other errors alone', () => {
    expect(isRetryable(Object.assign(new Error('dup'), { code: '23505' }))).toBe(false);
    expect(isRetryable('40001')).toBe(false);
  });
});

describe('withRetry', () => {
  it('retries a conflicting transaction until it succeeds', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(conflict())
      .mockRejectedValueOnce(conflict())
      .mockResolvedValue('ok');
    await expect(withRetry(fn, { baseDelayMs: 1 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('gives up after the last attempt', async () => {
    const error = conflict();
    const fn = vi.fn<() => Promise<never>>().mockRejectedValue(error);
    await expect(withRetry(fn, { attempts: 3, baseDelayMs: 1 })).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry other errors', async () => {
    const error = new Error('boom');
    const fn = vi.fn<() => Promise<never>>().mockRejectedValue(error);
    await expect(withRetry(fn)).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
