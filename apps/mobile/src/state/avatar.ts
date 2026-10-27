import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { parseResponse } from 'hono/client';

import { api } from '@/lib/api';
import { centerSquare } from '@/lib/photo';

import { postForm } from './receipts';

/** Profile photos are uploaded as a square JPEG of at most this many pixels a side. */
const EDGE = 512;
const QUALITY = 0.8;

/**
 * Picks a photo from the device and crops it to its centered square of at most 512px, as a
 * JPEG (the API takes up to 5 MB). Returns a local image URI, or undefined if the user backed out.
 */
export async function pickAvatar(): Promise<string | undefined> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled) return undefined;
  const image = await ImageManipulator.manipulate(result.assets[0]!.uri).renderAsync();
  const square = centerSquare(image.width, image.height);
  const context = ImageManipulator.manipulate(image).crop(square);
  if (square.width > EDGE) context.resize({ width: EDGE, height: EDGE });
  const saved = await (
    await context.renderAsync()
  ).saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
  return saved.uri;
}

/**
 * Uploads a picked photo (`pickAvatar`) as the user's: a presigned form straight to the private
 * bucket, then the API makes it their photo. Returns the updated profile.
 */
export async function uploadAvatar(uri: string) {
  const file = await (await fetch(uri)).blob();
  const form = await parseResponse(
    api.me.avatar['upload-url'].$post({ json: { contentType: 'image/jpeg', size: file.size } }),
  );
  await postForm(form, file, uri, () => {});
  return parseResponse(api.me.avatar.$post({ json: { key: form.key } }));
}
