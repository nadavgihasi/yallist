import { test as base, expect, type Page } from '@playwright/test';

import { addItem, newTrip, signIn } from './helpers';

// Two people on one trip, each in their own browser context (session), in one test: what the
// local stack can't serve (a real /<base>/j/<token> link; `expo serve` 404s on it) or doesn't
// run (AppSync Events).

const API_URL = process.env.E2E_API_URL;
const REALTIME_HOST = process.env.E2E_REALTIME_HOST;

/** `page` is Dana's session; `noa` a second one, with its own video. */
const test = base.extend<{ noa: Page }>({
  noa: async ({ browser, viewport, baseURL }, provide, testInfo) => {
    const context = await browser.newContext({
      viewport,
      baseURL,
      recordVideo: { dir: testInfo.outputPath('noa'), size: viewport ?? undefined },
    });
    await provide(await context.newPage());
    await context.close();
  },
});
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

const sessionToken = (page: Page) =>
  page.evaluate(
    () => (JSON.parse(localStorage.getItem('yallist/session')!) as { token: string }).token,
  );

/**
 * Dana makes a trip with a Tent that needs her approval to join, and copies its invite link;
 * Noa opens it in her own session and asks to join; Dana approves her. Ends with Noa on the
 * trip and Dana on its people tab.
 */
async function join(dana: Page, noa: Page) {
  await signIn(dana, 'Dana');
  await newTrip(dana);
  await addItem(dana, 'Tent');
  const tripUrl = dana.url();
  const tripId = new URL(tripUrl).pathname.split('/').at(-1)!;

  // The app has no switch for it yet, so through the API, from the page (CORS for a PATCH).
  const res = await dana.evaluate(
    async ([api, tripId, token]) =>
      (
        await fetch(`${api}/trips/${tripId}`, {
          method: 'PATCH',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ requireApproval: true }),
        })
      ).status,
    [API_URL!, tripId, await sessionToken(dana)] as const,
  );
  expect(res).toBe(200);

  // While alone, the hero invites; the people tab copies the link (Chrome has no Web Share).
  await dana.locator('#trip-hero-invite').click();
  await dana.locator('#people-share').click();
  const link = await dana.evaluate(() => navigator.clipboard.readText());
  // Under the preview's base path, which the shared router's root doesn't serve.
  expect(link.startsWith(new URL('j/', process.env.E2E_WEB_URL).href)).toBe(true);

  await noa.goto(link);
  await expect(noa.getByRole('heading', { name: 'E2E trip' })).toBeVisible({ timeout: 30_000 });
  await noa.locator('#join-name').fill('Noa');
  await noa.locator('#join-submit').click();
  await expect(noa.locator('#join-check')).toBeVisible();

  // Dana sees the request once her trip refetches: on a reload, after its 10 s staleTime.
  await expect(async () => {
    await dana.reload();
    await expect(dana.locator('#people-approve')).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 45_000 });
  await dana.locator('#people-approve').click();
  await expect(dana.locator('#people-approve')).toBeHidden();
  await noa.locator('#join-check').click();
  await expect(noa.locator('#trip-title')).toHaveText('E2E trip');
  return tripId;
}

test.skip(!API_URL, 'E2E_API_URL (the preview stage output `api`) not set');

test('join through an invite link; the hero then points at what is missing', async ({
  page: dana,
  noa,
}) => {
  await join(dana, noa);
  // Not alone any more: the hero's call to action opens the missing list.
  await dana.locator('#trip-hero-missing').click();
  await expect(dana.getByText('Tent', { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(dana.locator('#item-claim')).toBeVisible();
});

test('a claim reaches the other member over AppSync Events', async ({ page: dana, noa }) => {
  test.skip(!REALTIME_HOST, 'E2E_REALTIME_HOST (the preview stage output `realtime`) not set');
  const tripId = await join(dana, noa);
  await dana.locator('#trip-tab-bring').click();

  // Dana's session subscribes to the trip's channel from her page, as the app would: a
  // WebSocket from the site's origin, with her session token for the realtime authorizer.
  await dana.evaluate(
    async ([httpHost, tripId, token]) => {
      const auth = { host: httpHost, Authorization: token };
      const header = btoa(JSON.stringify(auth))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      const ws = new WebSocket(
        `wss://${httpHost.replace('appsync-api', 'appsync-realtime-api')}/event/realtime`,
        ['aws-appsync-event-ws', `header-${header}`],
      );
      const events: string[] = [];
      Object.assign(window, { realtimeEvents: events });
      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => ws.send(JSON.stringify({ type: 'connection_init' }));
        ws.onerror = () => reject(new Error('WebSocket failed'));
        ws.onmessage = ({ data }) => {
          const message = JSON.parse(data as string) as { type: string; event?: string };
          if (message.type === 'connection_ack') {
            const channel = `/trips/${tripId}`;
            const id = crypto.randomUUID();
            ws.send(JSON.stringify({ type: 'subscribe', id, channel, authorization: auth }));
          } else if (message.type === 'subscribe_success') resolve();
          else if (message.type === 'data') events.push(message.event!);
          else if (message.type.endsWith('error')) reject(new Error(String(data)));
        };
      });
    },
    [REALTIME_HOST!, tripId, await sessionToken(dana)] as const,
  );

  await noa.locator('#item-claim').click();
  await expect(noa.locator('#item-release')).toBeVisible();
  await expect
    .poll(() =>
      dana.evaluate(() => (window as unknown as { realtimeEvents: string[] }).realtimeEvents),
    )
    .toContainEqual(JSON.stringify({ type: 'changed', tripId }));

  // The app subscribes too (src/lib/realtime.ts), so Dana's list shows the claim without a reload.
  await expect(dana.locator('#item-claim')).toBeHidden({ timeout: 10_000 });
});

test('packing reaches the other member, who cannot toggle it', async ({ page: dana, noa }) => {
  test.skip(!REALTIME_HOST, 'E2E_REALTIME_HOST (the preview stage output `realtime`) not set');
  await join(dana, noa);
  await dana.locator('#trip-tab-bring').click();
  await expect(dana.locator('#bring-packed')).toHaveText('0 ארוזים');

  await noa.locator('#item-claim').click();
  await noa.locator('#item-pack').click();
  await expect(noa.locator('#item-unpack')).toBeVisible();

  // Over AppSync Events: no reload. Noa's claim isn't Dana's to pack, so she gets no toggle.
  await expect(dana.locator('#bring-packed')).toHaveText('ארוז 1', { timeout: 10_000 });
  await expect(dana.locator('#item-pack, #item-unpack')).toHaveCount(0);
});
