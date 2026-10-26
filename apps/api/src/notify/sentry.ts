import { createHmac, timingSafeEqual } from 'node:crypto';

import { escapeHtml } from './telegram';

/**
 * Whether `signature` (the Sentry-Hook-Signature header) is the hex HMAC-SHA256 of the raw
 * request body with the internal integration's client secret.
 */
export function verifySentrySignature(body: string, signature: string | undefined, secret: string) {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(body, 'utf8').digest();
  const given = Buffer.from(signature, 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

type EventAlert = {
  data?: {
    triggered_rule?: string;
    event?: { title?: string; culprit?: string; environment?: string; web_url?: string };
  };
};
type MetricAlert = {
  action?: string;
  data?: { description_title?: string; description_text?: string; web_url?: string };
};

const link = (url: string | undefined) =>
  url?.startsWith('https://') && `<a href="${escapeHtml(url, Infinity)}">Open in Sentry</a>`;

const lines = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join('\n');

/**
 * A Telegram message (HTML) for a Sentry webhook: an issue alert rule firing (`event_alert`: new
 * issue, regression, spike) or a metric alert changing state (`metric_alert`). Null for any
 * other resource (installation, issue, error webhooks), which aren't forwarded.
 */
export function formatSentryAlert(resource: string | undefined, payload: unknown) {
  if (resource === 'event_alert') {
    const { triggered_rule: rule, event } = (payload as EventAlert).data ?? {};
    return lines(
      `🐞 <b>[${escapeHtml(event?.environment ?? '?')}] Sentry: ${escapeHtml(rule ?? 'alert')}</b>`,
      event?.title && escapeHtml(event.title),
      event?.culprit && `<i>${escapeHtml(event.culprit)}</i>`,
      link(event?.web_url),
    );
  }
  if (resource === 'metric_alert') {
    const { action, data } = payload as MetricAlert;
    return lines(
      `${action === 'resolved' ? '✅' : '🔴'} <b>Sentry: ${escapeHtml(data?.description_title ?? 'metric alert')}</b>`,
      data?.description_text && escapeHtml(data.description_text),
      link(data?.web_url),
    );
  }
  return null;
}
