import { describe, expect, it } from 'vitest';

import { ltr } from './bidi';

describe('ltr', () => {
  it('isolates a number run with LRI and PDI', () => {
    expect(ltr('6/24')).toBe('⁦6/24⁩');
    expect(`${ltr('6/24')} מסודרים`).toBe('⁦6/24⁩ מסודרים');
  });
});
