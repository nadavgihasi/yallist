/**
 * Profile photos kept on the device (photoStore.ts in the app, photoStore.web.ts in the browser),
 * so they show at once, and offline, instead of downloading again.
 *
 * An uploaded photo's link is re-signed every hour (the API's `cachedViewUrl`), but the photo
 * behind it never changes: a new photo gets a new key. So a photo is kept under its link without
 * the query string (the signature), and stays valid for as long as the link points at it.
 */

/** How many photos are kept; the longest kept go first. A 512px JPEG is ~50 KB. */
export const MAX_PHOTOS = 150;

/** A photo link without its query string or fragment: the same photo, whatever its signature. */
export function photoCacheKey(url: string): string | undefined {
  try {
    const { origin, pathname, protocol } = new URL(url);
    if (protocol !== 'https:' && protocol !== 'http:') return undefined;
    return origin + pathname;
  } catch {
    return undefined;
  }
}

/** A file name for the photo kept under `key`: a hash of it, with its extension if it has one. */
export function photoFileName(key: string): string {
  // FNV-1a, twice with different seeds: 64 bits, so two photos never share a file.
  const hash = (seed: number) => {
    let h = seed;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  };
  const ext = /\.(jpe?g|png|webp)$/i.exec(key)?.[1]?.toLowerCase();
  return `${hash(0x811c9dc5)}${hash(0x01000193)}${ext ? `.${ext}` : ''}`;
}

/** Of the kept photos, the ones to remove so that at most `max` remain: the longest kept. */
export function photosToEvict<T extends { savedAt: number }>(photos: T[], max = MAX_PHOTOS): T[] {
  if (photos.length <= max) return [];
  return [...photos].sort((a, b) => a.savedAt - b.savedAt).slice(0, photos.length - max);
}
