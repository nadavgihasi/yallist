import { describe, expect, it } from 'vitest';

import { endAfterMovingStart } from './dates';

describe('endAfterMovingStart', () => {
  it('keeps the end while the start stays on or before it', () => {
    expect(endAfterMovingStart('2026-11-05', '2026-11-08', '2026-11-07')).toBe('2026-11-08');
    expect(endAfterMovingStart('2026-11-05', '2026-11-08', '2026-11-08')).toBe('2026-11-08');
    expect(endAfterMovingStart('2026-11-05', '2026-11-08', '2026-11-01')).toBe('2026-11-08');
  });

  it('moves the end with the start, keeping the length, once the start passes it', () => {
    expect(endAfterMovingStart('2026-11-05', '2026-11-07', '2026-11-30')).toBe('2026-12-02');
    expect(endAfterMovingStart('2026-11-05', '2026-11-05', '2026-11-09')).toBe('2026-11-09');
  });
});
