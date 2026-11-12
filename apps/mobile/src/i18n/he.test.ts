import { describe, expect, it } from 'vitest';

import { he, missingNames, removeWarning } from './he';

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

describe('removeWarning', () => {
  it('just asks when the member is settled', () => {
    expect(removeWarning('נועה', 0)).toBe('להסיר את נועה מהטיול?');
  });

  it('says how much the member owes and that the debt stays', () => {
    const text = removeWarning('נועה', -12000);
    expect(text).toContain('נועה חייב/ת לקבוצה ₪120.');
    expect(text).toContain('החוב נשאר בהעברות של הטיול');
  });

  it('says how much the group owes the member', () => {
    expect(removeWarning('נועה', 4550)).toContain('הקבוצה חייבת לנועה ₪45.5');
  });
});
