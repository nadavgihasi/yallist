import { describe, expect, it } from 'vitest';

import { he, missingNames } from './he';

const RLI = '⁧';
const PDI = '⁩';

// `סוללות AA, 2 גזיות` unisolated: `AA, 2` is one left-to-right run, so the 2 shows next to סוללות.
const names = ['סוללות AA', '2 גזיות'];
const isolated = `${RLI}סוללות AA${PDI}, ${RLI}2 גזיות${PDI}`;

describe('item names in a sentence', () => {
  it('isolates each name in the home card list', () => {
    expect(missingNames(names, 2)).toBe(isolated);
    expect(missingNames(names, 5)).toBe(`${isolated} ועוד 3`);
  });

  it('isolates each name in the hero call to action', () => {
    expect(he.hero.missing('חסרים 2', names, false)).toBe(`חסרים 2: ${isolated}`);
  });
});
