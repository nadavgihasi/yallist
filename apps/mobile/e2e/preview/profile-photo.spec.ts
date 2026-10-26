import { expect, test } from '@playwright/test';

import { isBucketGet, isBucketUpload, photo, pickFile, signIn } from './helpers';

// A profile photo through the browser's file input: cropped to a 512px square on the device,
// uploaded to the PR's S3 bucket, shown from it, then removed.
test('profile photo: pick, crop, upload to S3, show, remove', async ({ page }) => {
  await signIn(page, 'Dana');
  const origin = new URL(page.url()).origin;
  await page.locator('#home-profile').click();
  await expect(page.locator('#profile-photo-remove')).toBeHidden();

  const upload = page.waitForResponse(isBucketUpload);
  const shown = page.waitForResponse(isBucketGet('avatars/'));
  await pickFile(page.locator('#profile-photo-change'), await photo(page, 1200, 900));
  const uploaded = await upload;
  expect(uploaded.status()).toBe(204);
  expect(uploaded.headers()['access-control-allow-origin']).toBe(origin);
  expect((await shown).status()).toBe(200);
  await expect(page.locator('#profile-photo-remove')).toBeVisible();
  const avatar = page.locator(`img[src*="/avatars/"]`).first();
  await expect(avatar).toHaveJSProperty('naturalWidth', 512);
  await expect(avatar).toHaveJSProperty('naturalHeight', 512);

  await page.locator('#profile-photo-remove').click();
  await expect(page.locator('#profile-photo-remove')).toBeHidden();
  await expect(page.locator(`img[src*="/avatars/"]`)).toHaveCount(0);
});
