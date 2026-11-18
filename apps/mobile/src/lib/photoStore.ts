import { Directory, File, Paths } from 'expo-file-system';

import { photoFileName, photosToEvict } from './photoCache';

/**
 * Profile photos kept in the app's cache directory (photoCache.ts), one file each. The system
 * may clear it when the device runs low on storage; they're downloaded again then.
 */
const folder = () => new Directory(Paths.cache, 'photos');

/** The kept photo under `key`, as a local file URI, or undefined if there's none. */
export async function keptPhoto(key: string): Promise<string | undefined> {
  const file = new File(folder(), photoFileName(key));
  return file.exists ? file.uri : undefined;
}

/** Downloads the photo at `url` and keeps it under `key`; returns its local file URI. */
export async function keepPhoto(url: string, key: string): Promise<string> {
  const dir = folder();
  dir.create({ intermediates: true, idempotent: true });
  const file = new File(dir, photoFileName(key));
  // Into a temporary file first, so a download cut short is never shown as the photo.
  const part = new File(dir, `${file.name}.part`);
  if (part.exists) part.delete();
  await File.downloadFileAsync(url, part);
  if (file.exists) file.delete();
  await part.move(file);
  evict(dir);
  return file.uri;
}

/** Removes the photo kept under `key`, say one that no longer renders. */
export async function dropPhoto(key: string): Promise<void> {
  const file = new File(folder(), photoFileName(key));
  if (file.exists) file.delete();
}

/** Removes every kept photo: on sign-out. */
export async function dropAllPhotos(): Promise<void> {
  const dir = folder();
  if (dir.exists) dir.delete();
}

function evict(dir: Directory) {
  const files = dir
    .list()
    .filter((entry): entry is File => entry instanceof File && !entry.name.endsWith('.part'))
    .map((file) => ({ file, savedAt: file.modificationTime ?? 0 }));
  for (const { file } of photosToEvict(files)) file.delete();
}
