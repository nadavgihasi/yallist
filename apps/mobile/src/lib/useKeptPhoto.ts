import { useEffect, useState } from 'react';

import { photoCacheKey } from './photoCache';
import { dropAllPhotos, dropPhoto, keepPhoto, keptPhoto } from './photoStore';

/** Kept photos found this run, by key: shown on the first render, so lists don't blink. */
const found = new Map<string, string>();
/** Loads under way, so many avatars of one person read or download their photo once. */
const loading = new Map<string, Promise<string | undefined>>();

/** The photo kept on the device, else downloaded and kept; undefined if neither works. */
function load(url: string, key: string) {
  let pending = loading.get(key);
  if (!pending) {
    pending = (async () => (await keptPhoto(key)) ?? (await keepPhoto(url, key)))()
      .then((local) => {
        found.set(key, local);
        return local;
      })
      .catch(() => undefined)
      .finally(() => loading.delete(key));
    loading.set(key, pending);
  }
  return pending;
}

type Shown = { key: string; uri?: string; failed?: 'local' | 'network' };

/**
 * A profile photo to show, from the device (photoCache.ts): its kept copy, else it's downloaded
 * and kept. Undefined while it loads, so the initial shows meanwhile. If it can't be kept, the
 * link itself is shown. Call `onError` when the image fails to render: a broken kept copy is
 * dropped for the link; a broken link shows nothing (the initial).
 */
export function useKeptPhoto(url: string | undefined) {
  const key = url ? photoCacheKey(url) : undefined;
  const [shown, setShown] = useState<Shown>();

  useEffect(() => {
    if (!url || !key) return;
    let live = true;
    void load(url, key).then((uri) => {
      if (live) setShown((prev) => (prev?.key === key && prev.failed ? prev : { key, uri }));
    });
    return () => {
      live = false;
    };
  }, [url, key]);

  const current = shown?.key === key ? shown : undefined;
  let uri: string | undefined;
  if (!url || current?.failed === 'network') uri = undefined;
  else if (!key || current?.failed === 'local') uri = url;
  else if (current) uri = current.uri ?? url;
  else uri = found.get(key);

  const onError = () => {
    if (!url) return;
    if (key && uri !== url) {
      found.delete(key);
      void dropPhoto(key).catch(() => {});
      setShown({ key, failed: 'local' });
    } else {
      setShown({ key: key ?? url, failed: 'network' });
    }
  };
  return { uri, onError };
}

/** Forgets every kept photo: on sign-out, so the next user starts clean. */
export function forgetKeptPhotos() {
  found.clear();
  void dropAllPhotos().catch(() => {});
}
