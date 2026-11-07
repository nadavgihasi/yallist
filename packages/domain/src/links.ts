/** Longest meetup place the API keeps: a name or address, or a pasted map link. */
export const MEETUP_MAX = 300;
/** Longest photo album link the API keeps. */
export const ALBUM_URL_MAX = 300;

/** A host and, when only part of its site counts, the path prefix that does. */
type Allowed = readonly [host: string, path?: string];

/** Map links a meetup place may be instead of an address. */
const MAP_HOSTS: readonly Allowed[] = [
  ['waze.com'],
  ['www.waze.com'],
  ['ul.waze.com'],
  ['google.com', '/maps'],
  ['www.google.com', '/maps'],
  ['maps.app.goo.gl'],
  ['goo.gl', '/maps'],
];

/** Google Photos album links. */
const ALBUM_HOSTS: readonly Allowed[] = [['photos.app.goo.gl'], ['photos.google.com']];

// https, a host (no user info or port), then an optional path, query or fragment; no spaces.
const HTTPS_URL = /^https:\/\/([a-z0-9.-]+)([/?#]\S*)?$/i;

/** `text` if it's an https link to one of `allowed`, or undefined. */
function allowedUrl(text: string, allowed: readonly Allowed[]): string | undefined {
  const match = HTTPS_URL.exec(text.trim());
  if (!match) return undefined;
  const host = match[1]!.toLowerCase();
  const path = match[2] ?? '';
  // "/maps", "/maps/…", "/maps?…": not "/mapsfoo".
  const under = (prefix: string) =>
    path === prefix || ['/', '?', '#'].some((c) => path.startsWith(prefix + c));
  const ok = allowed.some(([h, prefix]) => h === host && (!prefix || under(prefix)));
  return ok ? text.trim() : undefined;
}

/** Text the user meant as a link (it has a scheme), rather than a place's name. */
const looksLikeUrl = (text: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(text.trim());

/** A Google Photos album link, or undefined if it isn't one. */
export const parseAlbumUrl = (text: string) => allowedUrl(text, ALBUM_HOSTS);

/** A pasted Google Maps or Waze link, or undefined if it isn't one. */
export const parseMapLink = (text: string) => allowedUrl(text, MAP_HOSTS);

/** A meetup place is a place's name or address, or a link to it in Google Maps or Waze. */
export const isMeetupPlace = (text: string) =>
  text.trim().length > 0 && (!looksLikeUrl(text) || parseMapLink(text) !== undefined);

/** A point on the map, in degrees (WGS 84). */
export type LatLng = { lat: number; lng: number };

/** A real point: finite, latitude within ±90 and longitude within ±180. */
export const isLatLng = (p: LatLng) =>
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lng) &&
  Math.abs(p.lat) <= 90 &&
  Math.abs(p.lng) <= 180;

/** "lat,lng" to 6 decimals (about 10 cm), as Waze and Google Maps take it. */
const latLng = ({ lat, lng }: LatLng) => `${+lat.toFixed(6)},${+lng.toFixed(6)}`;

/**
 * Where the meetup's buttons go. A point picked on the map opens there in Waze and in Google
 * Maps; otherwise a pasted map link opens as is, and a place's name or address opens as a search.
 */
export function meetupLinks(
  place: string | undefined,
  point?: LatLng,
): { link: string } | { waze: string; maps: string } | undefined {
  if (point) {
    const ll = latLng(point);
    return {
      waze: `https://waze.com/ul?ll=${ll}&navigate=yes`,
      maps: `https://www.google.com/maps/search/?api=1&query=${ll}`,
    };
  }
  if (!place?.trim()) return undefined;
  const link = parseMapLink(place);
  if (link) return { link };
  const query = encodeURIComponent(place.trim());
  return {
    waze: `https://waze.com/ul?q=${query}&navigate=yes`,
    maps: `https://www.google.com/maps/search/?api=1&query=${query}`,
  };
}
