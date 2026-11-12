import { describe, expect, it } from 'vitest';

import { he } from '@/i18n/he';

import { localPhone, partialAmount } from './settle';

describe('localPhone', () => {
  it('turns the stored number into the one Bit and PayBox take', () => {
    expect(localPhone('+972501234567')).toBe('0501234567');
  });
});

describe('partialAmount', () => {
  it('takes any amount up to what is owed', () => {
    expect(partialAmount('45', 10000)).toEqual({ agorot: 4500 });
    expect(partialAmount('100', 10000)).toEqual({ agorot: 10000 });
    expect(partialAmount('12.5', 10000)).toEqual({ agorot: 1250 });
  });

  it('says why it cannot be marked', () => {
    expect(partialAmount('', 10000)).toEqual({});
    expect(partialAmount('abc', 10000)).toEqual({ error: he.invalidAmount });
    expect(partialAmount('0', 10000)).toEqual({ error: he.invalidAmount });
    expect(partialAmount('100.01', 10000)).toEqual({ error: he.settle.overOwed });
  });
});
