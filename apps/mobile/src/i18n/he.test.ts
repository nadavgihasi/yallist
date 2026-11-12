import { describe, expect, it } from 'vitest';

import { bagLine, firstNames, he, missingNames, removeWarning } from './he';

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

describe('firstNames', () => {
  it('names all of a short list, each isolated', () => {
    expect(firstNames([])).toBe('');
    expect(firstNames(['אוהל'])).toBe(`${RLI}אוהל${PDI}`);
    expect(firstNames(['אוהל', 'קפה'])).toBe(`${RLI}אוהל${PDI}, ${RLI}קפה${PDI}`);
  });

  it('names the first three of a long list, then how many more', () => {
    const many = Array.from({ length: 14 }, (_, i) => `פריט ${i + 1}`);
    const first = [1, 2, 3].map((i) => `${RLI}פריט ${i}${PDI}`).join(', ');
    expect(firstNames(many)).toBe(`${first} ועוד 11`);
    expect(firstNames(['א', 'ב', 'ג', 'ד'], 2)).toBe(`${RLI}א${PDI}, ${RLI}ב${PDI} ועוד 2`);
  });
});

describe('bagLine', () => {
  it('says what the bag marked, or offers what nobody brings yet', () => {
    expect(bagLine(5, 0)).toBe('5 פריטים סומנו מהתיק שלך. נשאר רק לארוז.');
    expect(bagLine(0, 3)).toBe('3 פריטים כבר בתיק שלך');
    expect(bagLine(0, 1)).toBe('פריט אחד כבר בתיק שלך');
  });

  it('says both on one line', () => {
    expect(bagLine(5, 3)).toBe('5 סומנו מהתיק · עוד 3 בתיק שלך');
    expect(bagLine(1, 1)).toBe('פריט אחד סומן מהתיק · עוד אחד בתיק שלך');
  });
});
