import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { formatSentryAlert, verifySentrySignature } from './sentry';

const sign = (body: string, secret: string) =>
  createHmac('sha256', secret).update(body).digest('hex');

describe('verifySentrySignature', () => {
  const body = '{"action":"triggered"}';

  it('accepts the HMAC of the body with the client secret', () => {
    expect(verifySentrySignature(body, sign(body, 'secret'), 'secret')).toBe(true);
  });

  it('refuses anything else', () => {
    for (const signature of [
      undefined,
      '',
      'zz',
      sign(body, 'other'),
      sign(`${body} `, 'secret'),
      sign(body, 'secret').slice(0, 32),
    ]) {
      expect(verifySentrySignature(body, signature, 'secret')).toBe(false);
    }
  });
});

describe('formatSentryAlert', () => {
  it('formats an issue alert', () => {
    const payload = {
      action: 'triggered',
      data: {
        triggered_rule: 'New issue',
        event: {
          title: "TypeError: Cannot read properties of undefined (reading 'x') <b>",
          culprit: 'TripScreen',
          environment: 'production',
          web_url: 'https://yallist.sentry.io/issues/1/events/abc/',
        },
      },
    };
    expect(formatSentryAlert('event_alert', payload)).toBe(
      [
        '🐞 <b>[production] Sentry: New issue</b>',
        "TypeError: Cannot read properties of undefined (reading 'x') &lt;b&gt;",
        '<i>TripScreen</i>',
        '<a href="https://yallist.sentry.io/issues/1/events/abc/">Open in Sentry</a>',
      ].join('\n'),
    );
  });

  it('formats a metric alert, and drops links that are not https', () => {
    const payload = {
      action: 'resolved',
      data: {
        description_title: 'Resolved: error spike',
        description_text: '12 events in the last hour',
        web_url: 'javascript:alert(1)',
      },
    };
    expect(formatSentryAlert('metric_alert', payload)).toBe(
      '✅ <b>Sentry: Resolved: error spike</b>\n12 events in the last hour',
    );
  });

  it('ignores other webhooks', () => {
    expect(formatSentryAlert('installation', {})).toBeNull();
    expect(formatSentryAlert('issue', { action: 'created' })).toBeNull();
    expect(formatSentryAlert(undefined, {})).toBeNull();
  });
});
