/** Dates are stored as `YYYY-MM-DD` (local, no time zone). */

const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const MONTHS = [
  'בינואר',
  'בפברואר',
  'במרץ',
  'באפריל',
  'במאי',
  'ביוני',
  'ביולי',
  'באוגוסט',
  'בספטמבר',
  'באוקטובר',
  'בנובמבר',
  'בדצמבר',
];
const MONTH_NAMES = MONTHS.map((m) => m.slice(1));

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
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

/** `חמישי–שבת, 13–14 בנובמבר` / `שישי, 28 בנובמבר` / `שישי, 31 באוקטובר – ראשון, 2 בנובמבר` */
export function formatRange(startsOn: string, endsOn: string): string {
  const a = parseDate(startsOn);
  const b = parseDate(endsOn);
  const wa = WEEKDAYS[a.getDay()];
  const wb = WEEKDAYS[b.getDay()];
  if (startsOn === endsOn) return `${wa}, ${a.getDate()} ${MONTHS[a.getMonth()]}`;
  if (a.getMonth() === b.getMonth()) {
    return `${wa}–${wb}, ${a.getDate()}–${b.getDate()} ${MONTHS[a.getMonth()]}`;
  }
  return `${wa}, ${a.getDate()} ${MONTHS[a.getMonth()]} – ${wb}, ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

/** `חמישי, 13.11` */
export function formatShort(iso: string): string {
  const d = parseDate(iso);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()}.${d.getMonth() + 1}`;
}

/** `אוגוסט` */
export function monthName(iso: string): string {
  return MONTH_NAMES[parseDate(iso).getMonth()]!;
}

/** `היום` / `מחר` / `בעוד יומיים` / `בעוד 22 ימים` / `עכשיו בטיול` */
export function countdown(startsOn: string, endsOn: string, now = today()): string {
  const days = daysBetween(now, startsOn);
  if (days <= 0) return daysBetween(now, endsOn) >= 0 ? 'עכשיו בטיול' : 'הסתיים';
  if (days === 1) return 'מחר';
  if (days === 2) return 'בעוד יומיים';
  return `בעוד ${days} ימים`;
}
