import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addDays,
  countdown,
  daysBetween,
  endAfterMovingStart,
  formatRange,
  formatShort,
  monthName,
} from './dates';

// "This year" is 2026 in every test below.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 24, 12));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('addDays / daysBetween', () => {
  it('crosses month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 2)).toBe('2027-01-02');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
    expect(daysBetween('2026-12-31', '2027-01-02')).toBe(2);
    expect(daysBetween('2026-11-08', '2026-11-05')).toBe(-3);
  });
});

describe('formatRange', () => {
  it('writes one day', () => {
    expect(formatRange('2026-11-28', '2026-11-28')).toBe('שבת, 28 בנובמבר');
  });

  it('shares the month within one month', () => {
    expect(formatRange('2026-11-13', '2026-11-14')).toBe('שישי–שבת, 13–14 בנובמבר');
  });

  it('writes both months across a month end', () => {
    expect(formatRange('2026-10-31', '2026-11-02')).toBe('שבת, 31 באוקטובר – שני, 2 בנובמבר');
  });

  it('adds the year when the trip is not this year', () => {
    expect(formatRange('2027-08-05', '2027-08-05')).toBe('חמישי, 5 באוגוסט 2027');
    expect(formatRange('2026-12-31', '2027-01-02')).toBe(
      'חמישי, 31 בדצמבר 2026 – שבת, 2 בינואר 2027',
    );
  });
});

describe('formatShort / monthName', () => {
  it('formats', () => {
    expect(formatShort('2026-11-13')).toBe('שישי, 13.11');
    expect(monthName('2026-08-01')).toBe('אוגוסט');
    expect(monthName('2027-08-05')).toBe('אוגוסט 2027');
  });
});

describe('countdown', () => {
  const now = '2026-10-24';
  const at = (startsOn: string, endsOn: string) => countdown(startsOn, endsOn, now);

  it('counts the days to the start', () => {
    expect(at('2026-10-25', '2026-10-26')).toEqual({ phase: 'tomorrow', label: 'מחר!' });
    expect(at('2026-10-26', '2026-10-27')).toEqual({ phase: 'before', label: 'עוד יומיים' });
    expect(at('2026-11-15', '2026-11-16')).toEqual({ phase: 'before', label: 'עוד 22 ימים' });
  });

  it('says which day of the trip it is, or today for a one-day trip', () => {
    expect(at('2026-10-24', '2026-10-25')).toEqual({ phase: 'during', label: 'יום 1 מתוך 2' });
    expect(at('2026-10-22', '2026-10-24')).toEqual({ phase: 'during', label: 'יום 3 מתוך 3' });
    expect(at('2026-10-24', '2026-10-24')).toEqual({ phase: 'today', label: 'היום' });
  });

  it('says the trip ended after its last day', () => {
    expect(at('2026-10-20', '2026-10-23')).toEqual({ phase: 'after', label: 'הסתיים' });
  });
});

describe('endAfterMovingStart', () => {
  it('keeps the end while the start stays on or before it', () => {
    expect(endAfterMovingStart('2026-11-05', '2026-11-08', '2026-11-07')).toBe('2026-11-08');
    expect(endAfterMovingStart('2026-11-05', '2026-11-08', '2026-11-08')).toBe('2026-11-08');
    expect(endAfterMovingStart('2026-11-05', '2026-11-08', '2026-11-01')).toBe('2026-11-08');
  });

  it('moves the end with the start, keeping the length, once the start passes it', () => {
    expect(endAfterMovingStart('2026-11-05', '2026-11-07', '2026-11-30')).toBe('2026-12-02');
    expect(endAfterMovingStart('2026-11-05', '2026-11-05', '2026-11-09')).toBe('2026-11-09');
  });
});
