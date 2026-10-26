import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { sentryWebhookRoutes } from './sentry-webhook';

const telegram = { token: '1:abc', chatId: '42' };
const body = JSON.stringify({
  action: 'triggered',
  data: { triggered_rule: 'New issue', event: { title: 'Boom', environment: 'production' } },
});
const signature = createHmac('sha256', 'secret').update(body).digest('hex');

const post = (app: ReturnType<typeof sentryWebhookRoutes>, headers: Record<string, string>) =>
  app.request('/', { method: 'POST', body, headers });

describe('POST /webhooks/sentry', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('forwards a signed alert to Telegram', async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => new Response('{"ok":true}'));
    vi.stubGlobal('fetch', fetch);
    const app = sentryWebhookRoutes({ secret: 'secret', telegram });
    const res = await post(app, {
      'sentry-hook-signature': signature,
      'sentry-hook-resource': 'event_alert',
    });
    expect(res.status).toBe(204);
    expect(JSON.parse(fetch.mock.calls[0]![1].body as string).text).toBe(
      '🐞 <b>[production] Sentry: New issue</b>\nBoom',
    );
  });

  it('refuses a bad signature, and is off without a secret', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const headers = { 'sentry-hook-resource': 'event_alert' };
    const signed = { ...headers, 'sentry-hook-signature': signature };
    expect((await post(sentryWebhookRoutes({ secret: 'other', telegram }), signed)).status).toBe(
      401,
    );
    expect((await post(sentryWebhookRoutes({ secret: 'secret', telegram }), headers)).status).toBe(
      401,
    );
    expect((await post(sentryWebhookRoutes({ secret: null, telegram }), signed)).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('acknowledges webhooks it does not forward', async () => {
    const app = sentryWebhookRoutes({ secret: 'secret', telegram });
    const res = await post(app, {
      'sentry-hook-signature': signature,
      'sentry-hook-resource': 'installation',
    });
    expect(res.status).toBe(204);
  });

  it('answers 502 when Telegram fails', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 500 }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = sentryWebhookRoutes({ secret: 'secret', telegram });
    const res = await post(app, {
      'sentry-hook-signature': signature,
      'sentry-hook-resource': 'event_alert',
    });
    expect(res.status).toBe(502);
  });
});
