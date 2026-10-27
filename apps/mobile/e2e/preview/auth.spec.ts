import { expect, test, type Response } from '@playwright/test';

import { signIn } from './helpers';

// The browser's view of the real API Gateway from the CloudFront origin: CORS on the guest
// sign-in and on an authorized call (its preflight), which the local stack serves from one host.
test('guest sign-in and an authorized call pass CORS on the real API', async ({ page }) => {
  const api = (path: string) => (r: Response) =>
    r.request().method() !== 'OPTIONS' && new URL(r.url()).pathname.endsWith(path);
  const signedIn = page.waitForResponse(api('/api/auth/sign-in/anonymous'));
  const me = page.waitForResponse(api('/me'));
  await signIn(page, 'Dana');
  const origin = new URL(page.url()).origin;

  for (const response of [await signedIn, await me]) {
    expect(response.status()).toBe(200);
    // A different host from the site's, so the browser only reads it with a CORS header.
    expect(new URL(response.url()).origin).not.toBe(origin);
    expect(['*', origin]).toContain(response.headers()['access-control-allow-origin']);
  }
  expect(await (await me).request().headerValue('authorization')).toMatch(/^Bearer /);
  await expect(page.locator('#home-new-trip')).toBeVisible();
});
