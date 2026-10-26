import { Hono } from 'hono';

import { formatSentryAlert, verifySentrySignature } from '../notify/sentry';
import { sendTelegram, type Telegram } from '../notify/telegram';

export interface SentryWebhookConfig {
  /** The Sentry internal integration's client secret; null turns the webhook off (404). */
  secret: string | null;
  telegram: Telegram | null;
}

/**
 * Sentry's internal integration webhook (docs/deploy.md, Monitoring): forwards alerts to
 * Telegram. Signed with the client secret; anything unsigned is refused.
 */
export const sentryWebhookRoutes = ({ secret, telegram }: SentryWebhookConfig) =>
  new Hono().post('/', async (c) => {
    if (!secret) return c.json({ error: 'Not found' }, 404);
    const body = await c.req.text();
    if (!verifySentrySignature(body, c.req.header('sentry-hook-signature'), secret)) {
      return c.json({ error: 'Bad signature' }, 401);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      return c.json({ error: 'Bad JSON' }, 400);
    }
    const message = formatSentryAlert(c.req.header('sentry-hook-resource'), payload);
    if (!message) return c.body(null, 204);
    // Not thrown: an error report here could raise another alert through this same webhook.
    try {
      await sendTelegram(telegram, message);
    } catch (err) {
      console.error('Sentry alert not sent to Telegram', err);
      return c.json({ error: 'Telegram failed' }, 502);
    }
    return c.body(null, 204);
  });
