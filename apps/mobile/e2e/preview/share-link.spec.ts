import { expect, test } from '@playwright/test';

import { addItem, newTrip, signIn } from './helpers';

// #210: the trip hero's WhatsApp message carried `yallist:///j/<token>` instead of the invite
// link, so no one could open it. Every link the app shares must be the invite sheet's https link,
// and opening it must land on the trip's join page.

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test("the hero's WhatsApp message and the invite sheet share the same working link", async ({
  page,
  browser,
  viewport,
}) => {
  await signIn(page, 'Dana');
  await newTrip(page);
  await addItem(page, 'Tent');

  // The invite sheet's link.
  await page.locator('#trip-hero-invite').click();
  await page.locator('#invite-copy-link').click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  await expect(page.locator('#invite-message')).toContainText(link);
  await page.keyboard.press('Escape');
  expect(link.startsWith(new URL('j/', process.env.E2E_WEB_URL).href)).toBe(true);

  // The hero's share button opens WhatsApp in a new tab: its message carries the same link.
  // Caught at window.open, so the test doesn't depend on wa.me.
  await page.evaluate(() => {
    const opened: string[] = [];
    Object.assign(window, { opened });
    window.open = (url?: string | URL) => {
      opened.push(String(url));
      return null;
    };
  });
  await page.locator('#trip-hero-share').click();
  const whatsApp = new URL(
    await page.evaluate(() => (window as unknown as { opened: string[] }).opened[0] ?? ''),
  );
  expect(whatsApp.host).toBe('wa.me');
  const text = whatsApp.searchParams.get('text') ?? '';
  expect(text).toContain('Tent');
  const shared = text.match(/[a-z][a-z0-9+.-]*:\/\/\S+/i)?.[0]?.replace(/[⁦-⁩‎‏]/g, '');
  expect(shared).toBe(link);

  // Someone else opens the shared link and gets the trip's join page.
  const friend = await browser.newContext({ viewport });
  const other = await friend.newPage();
  await other.goto(shared!);
  await expect(other.getByRole('heading', { name: 'E2E trip' })).toBeVisible({ timeout: 30_000 });
  await expect(other.locator('#join-name')).toBeVisible();
  await friend.close();
});
