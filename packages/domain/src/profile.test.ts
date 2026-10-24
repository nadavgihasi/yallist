import { describe, expect, it } from 'vitest';

import { formatIsraeliMobile, parseIsraeliMobile } from './profile';

describe('parseIsraeliMobile', () => {
  it.each([
    '0501234567',
    '050-123-4567',
    '050 123 4567',
    '+972 50-123-4567',
    '972501234567',
    '+972 (0)50-123-4567',
  ])('reads %s', (text) => expect(parseIsraeliMobile(text)).toBe('+972501234567'));

  it.each(['', '050123456', '05012345678', '031234567', '+1 650 123 4567', '050-abc-4567'])(
    'rejects %s',
    (text) => expect(parseIsraeliMobile(text)).toBeUndefined(),
  );
});

describe('formatIsraeliMobile', () => {
  it('writes the local form', () => {
    expect(formatIsraeliMobile('+972501234567')).toBe('050-123-4567');
  });
});
