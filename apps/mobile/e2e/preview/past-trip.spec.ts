import { expect, test } from '@playwright/test';

import { newTrip, signIn } from './helpers';

// A trip that has ended shows as a row under "past trips" on home. That row once passed a style
// array to an expo-router `Link asChild`, which reached the DOM as indexed keys: Chrome threw
// "Failed to set an indexed property [0] on 'CSSStyleDeclaration'" and every visit to home
// showed the error screen (Sentry YALLIST-APP-1). Only a real browser DOM throws it, so it's
// tested here and not in vitest.
test('home shows a past trip without crashing', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await signIn(page, 'Dana');
  await newTrip(page, 'Past trip');

  // Moves it into the past: the edit sheet's start date has no minimum, unlike a new trip's.
  await page.locator('#trip-rename-edit').click();
  const dates = page.locator('input[type=date]').filter({ visible: true });
  await dates.nth(0).fill('2025-01-10');
  await dates.nth(1).fill('2025-01-12');
  await page.locator('#trip-rename-save').click();
  await expect(page.locator('#trip-rename-save')).toBeHidden();

  await page.goto('./');
  await expect(page.locator('#home-past-trip')).toBeVisible();
  await expect(page.locator('#home-past-trip')).toContainText('Past trip');
  await expect(page.locator('#error-retry')).toBeHidden();
  expect(errors).toEqual([]);
});
