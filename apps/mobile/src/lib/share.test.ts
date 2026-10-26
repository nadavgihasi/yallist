import { describe, expect, it } from 'vitest';

import { missingMessage } from './share';

const LRI = '⁦';
const PDI = '⁩';
const trip = { name: 'קמפינג בכנרת', startsOn: '2026-11-08', endsOn: '2026-11-09' };
const link = 'https://yallist.app/j/abc';

describe('missingMessage', () => {
  it('names what is missing, isolating the dates and the link', () => {
    expect(missingMessage(trip, ['אוהלים', 'קפה', 'קרח'], link)).toBe(
      `חסרים לקמפינג בכנרת (${LRI}8–9${PDI} בנובמבר): אוהלים, קפה, קרח. מי מביא? ${LRI}${link}${PDI}`,
    );
  });

  it('lists up to five names, then how many more', () => {
    const missing = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח'];
    expect(missingMessage(trip, missing, link)).toContain(': א, ב, ג, ד, ה ועוד 3. מי מביא?');
  });

  it('writes one-day and month-spanning trips', () => {
    const day = { ...trip, startsOn: '2026-11-21', endsOn: '2026-11-21' };
    expect(missingMessage(day, ['קרח'], link)).toContain('(21 בנובמבר)');
    const span = { ...trip, startsOn: '2026-10-31', endsOn: '2026-11-02' };
    expect(missingMessage(span, ['קרח'], link)).toContain('(31 באוקטובר – 2 בנובמבר)');
  });

  it('celebrates once nothing is missing', () => {
    expect(missingMessage(trip, [], link)).toBe(`הכול מכוסה לקמפינג בכנרת 🎉 ${LRI}${link}${PDI}`);
  });
});
