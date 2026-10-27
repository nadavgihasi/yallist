import { SaveFormat, ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { parseResponse } from 'hono/client';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { showToast } from '@/components/Toast';
import { he } from '@/i18n/he';
import { api } from '@/lib/api';

import { queryClient } from './store';
import { tripKey } from './trips';

/** Long edge and JPEG quality the app shrinks receipt photos to before uploading. */
const MAX_EDGE = 2000;
const QUALITY = 0.8;

/**
 * Picks a receipt photo and shrinks it on the device, so uploads stay small (the API takes up to
 * 10 MB). Returns a local image URI, or undefined if the user backed out.
 */
export async function pickReceipt(source: 'camera' | 'library'): Promise<string | undefined> {
  if (source === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
    showToast(he.receipt.noCamera, 'error');
    return undefined;
  }
  const launch =
    source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
  const result = await launch({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled) return undefined;
  const { uri, width, height } = result.assets[0]!;
  const image = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_EDGE) {
    image.resize(width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const shrunk = await (
    await image.renderAsync()
  ).saveAsync({
    compress: QUALITY,
    format: SaveFormat.JPEG,
  });
  return shrunk.uri;
}

/** An upload in flight or failed; gone once the receipt is attached. */
export interface ReceiptUpload {
  uri: string;
  /** 0 to 1. */
  progress: number;
  failed: boolean;
}

const uploads = new Map<string, ReceiptUpload>();
const listeners = new Set<() => void>();

function setUpload(expenseId: string, upload: ReceiptUpload | undefined) {
  if (upload) uploads.set(expenseId, upload);
  else uploads.delete(expenseId);
  listeners.forEach((l) => l());
}

/** The expense's receipt upload, while it's in flight or failed. */
export const useReceiptUpload = (expenseId: string) =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => uploads.get(expenseId),
  );

/** Posts a presigned form and a JPEG to the photos bucket, reporting progress (fetch can't). */
export function postForm(
  form: { url: string; fields: Record<string, string> },
  file: Blob,
  uri: string,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const body = new FormData();
    for (const [name, value] of Object.entries(form.fields)) body.append(name, value);
    // React Native sends a file by URI; the web sends the blob.
    const nativeFile = { uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob;
    body.append('file', Platform.OS === 'web' ? file : nativeFile);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', form.url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(body);
  });
}

/**
 * Uploads a shrunk photo (`pickReceipt`) as the expense's receipt: a presigned form straight to the
 * private bucket, then the API attaches it. Progress and failure show through `useReceiptUpload`;
 * a failed upload keeps its photo for a retry.
 */
export async function uploadReceipt(tripId: string, expenseId: string, uri: string) {
  const report = (progress: number, failed = false) =>
    setUpload(expenseId, { uri, progress, failed });
  report(0);
  try {
    const param = { tripId, expenseId };
    const receipt = api.trips[':tripId'].expenses[':expenseId'].receipt;
    const file = await (await fetch(uri)).blob();
    const form = await parseResponse(
      receipt['upload-url'].$post({ param, json: { contentType: 'image/jpeg', size: file.size } }),
    );
    await postForm(form, file, uri, report);
    await parseResponse(receipt.$post({ param, json: { key: form.key } }));
    // The viewer's link to a receipt this one replaces (receipt.tsx) points at a deleted photo.
    queryClient.removeQueries({ queryKey: ['receipt', expenseId] });
    await queryClient.invalidateQueries({ queryKey: tripKey(tripId) });
    setUpload(expenseId, undefined);
  } catch (error) {
    console.warn('Receipt upload failed', error);
    report(0, true);
    return false;
  }
  return true;
}
