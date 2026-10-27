import { expect, test } from '@playwright/test';

// The URL on the Google Play listing: a deep link, signed out, served by the site's fallback.
test('the privacy policy opens signed out, in Hebrew and in English', async ({ page }) => {
  await page.goto('privacy');
  await expect(page.locator('#privacy-title')).toHaveText('מדיניות פרטיות');
  await page.goto('privacy?lang=en');
  await expect(page.locator('#privacy-title')).toHaveText('Privacy policy');
});
