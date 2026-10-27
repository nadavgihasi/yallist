import { expect, test } from '@playwright/test';

import { isBucketGet, isBucketUpload, newTrip, photo, pickFile, signIn } from './helpers';

// The real path a receipt takes on the web, which the local stack fakes: the browser's file
// input, the shrink on the device, the presigned POST to the PR's S3 bucket (its CORS), the
// attach, the viewer's presigned GET, and deleting it.
test('receipt photo: pick, shrink, upload to S3, view, delete, add again', async ({ page }) => {
  await signIn(page, 'Dana');
  await newTrip(page);
  const origin = new URL(page.url()).origin;

  await page.locator('#trip-tab-money').click();
  await page.locator('#trip-add').click();
  await page.locator('#expense-amount').fill('80');
  await page.locator('#expense-what').fill('Pizza');
  // A 3000×4000 phone photo; the app uploads it at most 2000px on its long edge.
  await pickFile(page.locator('#receipt-choose'), await photo(page, 3000, 4000));
  await expect(page.locator('#receipt-thumb')).toBeVisible();

  const upload = page.waitForResponse(isBucketUpload);
  await page.locator('#expense-save').click();
  await expect(page.getByText('Pizza', { exact: true }).filter({ visible: true })).toBeVisible();
  const uploaded = await upload;
  expect(uploaded.status()).toBe(204);
  expect(uploaded.headers()['access-control-allow-origin']).toBe(origin);

  // The viewer opens once the receipt is attached, and loads it from the bucket.
  const shown = page.waitForResponse(isBucketGet('trips/'));
  await page.locator('#expense-receipt').click();
  expect((await shown).status()).toBe(200);
  const image = page.locator('#receipt-image img');
  await expect(image).toHaveJSProperty('naturalWidth', 1500);
  await expect(image).toHaveJSProperty('naturalHeight', 2000);

  // Twice: the second tap confirms.
  await page.locator('#receipt-delete').click();
  await page.locator('#receipt-delete').click();
  await expect(page.locator('#receipt-image')).toBeHidden();

  // Again from the expense's own receipt sheet.
  await page.locator('#expense-receipt').click();
  await pickFile(page.locator('#receipt-choose'), await photo(page, 800, 600));
  await expect(image).toHaveJSProperty('naturalWidth', 800);
});
