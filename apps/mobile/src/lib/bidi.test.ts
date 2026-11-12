import { describe, expect, it } from 'vitest';

import { isolate, ltr, rtl } from './bidi';

describe('ltr', () => {
  it('isolates a number run with LRI and PDI', () => {
    expect(ltr('6/24')).toBe('⁦6/24⁩');
    expect(`${ltr('6/24')} מסודרים`).toBe('⁦6/24⁩ מסודרים');
  });
});

describe('rtl', () => {
  it('isolates an item name right to left with RLI and PDI', () => {
    expect(rtl('USB מטען')).toBe('⁧USB מטען⁩');
  });
});

describe('isolate', () => {
  it('isolates a run with FSI and PDI', () => {
    expect(isolate('2/4')).toBe('⁨2/4⁩');
  });
});
