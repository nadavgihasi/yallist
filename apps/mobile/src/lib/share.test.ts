import { describe, expect, it, vi } from 'vitest';

import { missingMessage, openWhatsApp } from './share';

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

describe('openWhatsApp', () => {
  const url = 'https://wa.me/?text=%D7%97%D7%A1%D7%A8%20%D7%A7%D7%A8%D7%97';

  it('opens a new tab on web, keeping the app in its own', async () => {
    const openURL = vi.fn(() => Promise.resolve());
    const win = { open: vi.fn(() => null) };
    await openWhatsApp('חסר קרח', 'web', openURL, win);
    expect(win.open).toHaveBeenCalledWith(url, '_blank', 'noopener');
    expect(openURL).not.toHaveBeenCalled();
  });

  it('opens the WhatsApp app on native', async () => {
    const openURL = vi.fn(() => Promise.resolve());
    const win = { open: vi.fn(() => null) };
    await openWhatsApp('חסר קרח', 'android', openURL, win);
    expect(openURL).toHaveBeenCalledWith(url);
    expect(win.open).not.toHaveBeenCalled();
  });

  it('rejects where native cannot open it', async () => {
    const openURL = vi.fn(() => Promise.reject(new Error('no app')));
    await expect(
      openWhatsApp('x', 'android', openURL, { open: vi.fn(() => null) }),
    ).rejects.toThrow();
  });
});
