import { splitEqually } from '@yallist/domain';
import { describe, expect, it, vi } from 'vitest';

import { perPersonText } from './labels';

// The theme pulls in react-native, which these unit tests don't run.
vi.mock('@/theme', () => ({ colors: {} }));

describe('perPersonText', () => {
  it('shows the checkout share with two decimals, the same in every place', () => {
    // ₪412.90 between 3: 137.64 + 137.63 + 137.63. The largest share, never ₪137.6.
    expect(perPersonText(41290, 3)).toBe('₪137.64');
    const shares = [...splitEqually(41290, ['a', 'b', 'c']).values()];
    expect(shares.reduce((a, b) => a + b, 0)).toBe(41290);
    expect(Math.max(...shares)).toBe(13764);
  });

  it('has nothing to show without an amount or anyone to split with', () => {
    expect(perPersonText(undefined, 3)).toBeUndefined();
    expect(perPersonText(41290, 0)).toBeUndefined();
  });
});
