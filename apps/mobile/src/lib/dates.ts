import { he } from '@/i18n/he';

/** Dates are stored as `YYYY-MM-DD` (local, no time zone). */

const { weekdays: WEEKDAYS, months: MONTHS } = he.dates;
/** `בנובמבר` → `נובמבר` */
const MONTH_NAMES = MONTHS.map((m) => m.slice(1));

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d);
}

export function toISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function today(): string {
  return toISODate(new Date());
}

/** Whole days from `from` to `to` (both ISO). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86_400_000);
}

/** ` 2027` when the date isn't in the current year, else empty. */
function yearSuffix(d: Date): string {
  return d.getFullYear() === new Date().getFullYear() ? '' : ` ${d.getFullYear()}`;
}

/**
 * `חמישי–שבת, 13–14 בנובמבר` / `שישי, 28 בנובמבר` / `שישי, 31 באוקטובר – ראשון, 2 בנובמבר`.
 * Adds the year when the trip isn't this year.
 */
export function formatRange(startsOn: string, endsOn: string): string {
  const a = parseDate(startsOn);
  const b = parseDate(endsOn);
  const wa = WEEKDAYS[a.getDay()];
  const wb = WEEKDAYS[b.getDay()];
  const sameYear = a.getFullYear() === b.getFullYear();
  if (startsOn === endsOn) return `${wa}, ${a.getDate()} ${MONTHS[a.getMonth()]}${yearSuffix(a)}`;
  if (sameYear && a.getMonth() === b.getMonth()) {
    return `${wa}–${wb}, ${a.getDate()}–${b.getDate()} ${MONTHS[a.getMonth()]}${yearSuffix(a)}`;
  }
  const startYear = sameYear ? '' : ` ${a.getFullYear()}`;
  return `${wa}, ${a.getDate()} ${MONTHS[a.getMonth()]}${startYear} – ${wb}, ${b.getDate()} ${MONTHS[b.getMonth()]}${sameYear ? yearSuffix(b) : ` ${b.getFullYear()}`}`;
}

/** `חמישי, 13.11` */
export function formatShort(iso: string): string {
  const d = parseDate(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}`;
}

/** `אוגוסט` / `אוגוסט 2025` */
export function monthName(iso: string): string {
  const d = parseDate(iso);
  return `${MONTH_NAMES[d.getMonth()]}${yearSuffix(d)}`;
}

/** `מחר` / `בעוד יומיים` / `בעוד 22 ימים`; `עכשיו בטיול` from the first day to the last, then `הסתיים`. */
export function countdown(startsOn: string, endsOn: string, now = today()): string {
  const days = daysBetween(now, startsOn);
  const c = he.countdown;
  if (days <= 0) return daysBetween(now, endsOn) >= 0 ? c.now : c.ended;
  if (days === 1) return c.tomorrow;
  if (days === 2) return c.twoDays;
  return c.days(days);
}

/** The end date after the start moves to `nextStart`: kept, unless the start passed it; then the trip keeps its length. */
export function endAfterMovingStart(startsOn: string, endsOn: string, nextStart: string): string {
  if (endsOn >= nextStart) return endsOn;
  return addDays(nextStart, Math.max(0, daysBetween(startsOn, endsOn)));
}
