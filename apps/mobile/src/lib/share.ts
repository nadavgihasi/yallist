import { andMore, he } from '@/i18n/he';

import { ltr } from './bidi';
import { parseDate } from './dates';

const MAX_NAMES = 5;

/** `8–9 בנובמבר` / `21 בנובמבר` / `31 באוקטובר – 2 בנובמבר`, number runs isolated. */
function days(startsOn: string, endsOn: string): string {
  const a = parseDate(startsOn);
  const b = parseDate(endsOn);
  const month = (d: Date) => he.dates.months[d.getMonth()];
  if (startsOn === endsOn) return `${a.getDate()} ${month(a)}`;
  if (a.getMonth() === b.getMonth()) return `${ltr(`${a.getDate()}–${b.getDate()}`)} ${month(a)}`;
  return `${a.getDate()} ${month(a)} – ${b.getDate()} ${month(b)}`;
}

/**
 * The WhatsApp message for what's still missing (#51): `חסרים לקמפינג בכנרת (8–9 בנובמבר): אוהלים,
 * קפה, קרח ועוד 10. מי מביא? {link}`, up to 5 names; once nothing is missing, a 🎉 instead.
 */
export function missingMessage(
  trip: { name: string; startsOn: string; endsOn: string },
  missing: string[],
  link: string,
): string {
  const url = ltr(link);
  if (missing.length === 0) return he.share.allCovered(trip.name, url);
  const names = missing.slice(0, MAX_NAMES).join(', ');
  const more = missing.length > MAX_NAMES ? ` ${andMore(missing.length - MAX_NAMES)}` : '';
  return he.share.missing(trip.name, days(trip.startsOn, trip.endsOn), `${names}${more}`, url);
}

/**
 * Opens WhatsApp with `text` ready to send: on web in a new tab, since following the link the way
 * expo-linking does would replace the app's own page; on native, in the WhatsApp app. Rejects
 * where native can't open it, so the caller can fall back to the share sheet.
 */
export async function openWhatsApp(
  text: string,
  os: string,
  openURL: (url: string) => Promise<unknown>,
  win: Pick<Window, 'open'> = window,
): Promise<void> {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  if (os === 'web') {
    win.open(url, '_blank', 'noopener');
    return;
  }
  await openURL(url);
}

/**
 * The invite message, exactly as the invite sheet shows it and shares it: `בואו לקמפינג בכנרת
 * (8–9 בנובמבר)! מצטרפים מהקישור, בלי הורדה, ורואים מי מביא מה: {link}`. The link once, inside it.
 */
export function inviteMessage(
  trip: { name: string; startsOn: string; endsOn: string },
  link: string,
): string {
  return he.invite.message(trip.name, days(trip.startsOn, trip.endsOn), ltr(link));
}
