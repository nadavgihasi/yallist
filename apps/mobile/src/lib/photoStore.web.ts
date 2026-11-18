import { photosToEvict } from './photoCache';

/**
 * Profile photos kept in the browser's Cache Storage (photoCache.ts), and shown from object URLs.
 * Cache Storage is only there on HTTPS (and localhost); elsewhere photos load from the network.
 */
const CACHE = 'yallist/photos';

/** Object URLs made this page load, so each kept photo is read once. */
const objectUrls = new Map<string, string>();

const storage = () => (typeof caches === 'undefined' ? undefined : caches.open(CACHE));

const objectUrl = (key: string, blob: Blob) => {
  const url = URL.createObjectURL(blob);
  objectUrls.set(key, url);
  return url;
};

/** The kept photo under `key`, as an object URL, or undefined if there's none. */
export async function keptPhoto(key: string): Promise<string | undefined> {
  const known = objectUrls.get(key);
  if (known) return known;
  const kept = await (await storage())?.match(key);
  return kept ? objectUrl(key, await kept.blob()) : undefined;
}

/** Downloads the photo at `url` (the bucket allows it by CORS) and keeps it under `key`. */
export async function keepPhoto(url: string, key: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  if (!res.ok || !blob.type.startsWith('image/')) throw new Error(`Photo failed: ${res.status}`);
  const cache = await storage();
  if (cache) {
    await cache.put(key, new Response(blob, { headers: { 'Content-Type': blob.type } }));
    // Kept in the order they were put.
    const kept = (await cache.keys()).map((request, savedAt) => ({ request, savedAt }));
    await Promise.all(photosToEvict(kept).map(({ request }) => cache.delete(request)));
  }
  return objectUrl(key, blob);
}

/** Removes the photo kept under `key`, say one that no longer renders. */
export async function dropPhoto(key: string): Promise<void> {
  const url = objectUrls.get(key);
  if (url) URL.revokeObjectURL(url);
  objectUrls.delete(key);
  await (await storage())?.delete(key);
}

/** Removes every kept photo: on sign-out. */
export async function dropAllPhotos(): Promise<void> {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
  if (typeof caches !== 'undefined') await caches.delete(CACHE);
}
