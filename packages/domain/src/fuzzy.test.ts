import { describe, expect, it } from 'vitest';

import { typoDistance, typoMatch, typosAllowed } from './fuzzy';

describe('typoDistance', () => {
  it('counts a missing, extra, wrong or swapped letter as one', () => {
    expect(typoDistance('צדנית', 'צידנית', 1)).toBe(1); // missing
    expect(typoDistance('מנגאל', 'מנגל', 1)).toBe(1); // extra
    expect(typoDistance('מנגק', 'מנגל', 1)).toBe(1); // wrong
    expect(typoDistance('נמגל', 'מנגל', 1)).toBe(1); // swapped
    expect(typoDistance('tnet', 'tent', 1)).toBe(1);
    expect(typoDistance('מנגל', 'מנגל', 1)).toBe(0);
  });

  it('gives up past the most it allows', () => {
    expect(typoDistance('אוהל', 'מנגל', 1)).toBeUndefined();
    expect(typoDistance('אבטחה', 'אבטיח', 1)).toBeUndefined();
    expect(typoDistance('אבטחה', 'אבטיח', 2)).toBe(2);
    expect(typoDistance('א', 'אבגדה', 1)).toBeUndefined();
  });

  it('matches the start of a word when asked', () => {
    expect(typoDistance('צדני', 'צידנית', 1)).toBeUndefined();
    expect(typoDistance('צדני', 'צידנית', 1, true)).toBe(1);
    expect(typoDistance('מנג', 'מנגל', 0, true)).toBe(0);
  });
});

describe('typosAllowed', () => {
  it('allows none for short words, one, then two for long ones', () => {
    expect(typosAllowed('אב')).toBe(0);
    expect(typosAllowed('אוהל')).toBe(1);
    expect(typosAllowed('צידניות')).toBe(2);
  });
});

describe('typoMatch', () => {
  it('needs every typed word to be near a word of the name', () => {
    expect(typoMatch(['שק', 'שנה'], ['שק', 'שינה'])).toBe(1);
    // A quarter more for a word in another place.
    expect(typoMatch(['צדנית'], ['מטחנה', 'ידנית'])).toBe(1.25);
    expect(typoMatch(['שק', 'שנה'], ['מזרן', 'שינה'])).toBeUndefined();
  });

  it('matches a long typed word against the start of a word', () => {
    // For half a typo more than a whole word: סלמן is סלמון before it is the start of סלינג.
    expect(typoMatch(['צדני'], ['צידנית'])).toBe(1.5);
    // Words come normalized: final letters as regular ones.
    expect(typoMatch(['סלמנ'], ['סלמונ'])).toBe(1);
    expect(typoMatch(['סלמנ'], ['סלינג'])).toBe(1.5);
    expect(typoMatch(['שק', 'שי'], ['שק', 'שינה'])).toBe(0.5);
    // A short one only against a whole word: אהל is a typo of אוהל, not of אוהלים's start.
    expect(typoMatch(['אהל'], ['אוהל'])).toBe(1);
    expect(typoMatch(['אהל'], ['אוהלים'])).toBeUndefined();
  });
});
