import { expect, type Locator, type Page, type Response } from '@playwright/test';

/** A new guest from a clean context, on the empty home screen. */
export async function signIn(page: Page, name: string) {
  await page.goto('./');
  await page.locator('#login-guest').click();
  await page.locator('#login-name').fill(name);
  await page.locator('#login-start').click();
  // The first requests after a deploy wake the Lambda and the database.
  await expect(page.locator('#home-new-trip')).toBeVisible({ timeout: 30_000 });
}

/** From home: a blank trip, ending on its screen. */
export async function newTrip(page: Page, name = 'E2E trip') {
  await page.locator('#home-new-trip').click();
  await page.locator('#new-trip-template-blank').click();
  await page.locator('#new-trip-name').fill(name);
  await page.locator('#new-trip-create').click();
  await expect(page.locator('#trip-title')).toHaveText(name);
}

/** On the trip screen: adds an item to the current list. */
export async function addItem(page: Page, name: string) {
  await page.locator('#trip-add').click();
  await page.locator('#item-form-name').fill(name);
  await page.locator('#item-form-save').click();
  await expect(page.getByText(name, { exact: true }).filter({ visible: true })).toBeVisible();
}

/** A JPEG of the given size, drawn in the page: say a phone photo, larger than the app uploads. */
export async function photo(page: Page, width: number, height: number) {
  const base64 = await page.evaluate(
    ({ w, h }) => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, '#1f7a5c');
      gradient.addColorStop(1, '#f2c14e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
      return canvas.toDataURL('image/jpeg', 0.9).split(',')[1]!;
    },
    { w: width, h: height },
  );
  return { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(base64, 'base64') };
}

/**
 * Clicks `button`, which opens the browser's file picker (expo-image-picker's
 * `<input type="file">`), and picks `file` in it, as a person would.
 */
export async function pickFile(button: Locator, file: Awaited<ReturnType<typeof photo>>) {
  const chooser = button.page().waitForEvent('filechooser');
  await button.click();
  await (await chooser).setFiles(file);
}

const BUCKET = /^https:\/\/[^/]+\.s3\.[^/]+\.amazonaws\.com\//;

/** The upload to the photos bucket: a presigned POST from the page, allowed by the bucket's CORS. */
export const isBucketUpload = (r: Response) =>
  r.request().method() === 'POST' && BUCKET.test(r.url());

/** A photo under `prefix` the page loads from the bucket through a presigned GET. */
export const isBucketGet = (prefix: string) => (r: Response) =>
  r.request().method() === 'GET' &&
  BUCKET.test(r.url()) &&
  new URL(r.url()).pathname.startsWith(`/${prefix}`) &&
  r.url().includes('X-Amz-Signature=');
