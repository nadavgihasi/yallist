import { describe, expect, it } from 'vitest';

import { scrubEvent, scrubText } from './scrub';

describe('scrubText', () => {
  it.each([
    ['Authorization: Bearer abc.def', 'Authorization: Bearer [token]'],
    [
      'POST https://api.telegram.org/bot123456:AAH-x_y/sendMessage',
      'POST https://api.telegram.org/bot[token]/sendMessage',
    ],
    ['mail dana.k+1@example.co.il now', 'mail [email] now'],
    ['call 054-1234567 or +972 54 123 4567', 'call [phone] or [phone]'],
    ['GET /invites/Zx81kQp0aLm2Nn3Bb4Vv5Cc6', 'GET /invites/[token]'],
    ['trip 123e4567-e89b-12d3-a456-426614174000', 'trip [token]'],
    ['שלום דנה כהן, hi', '[he], hi'],
  ])('%s', (input, output) => expect(scrubText(input)).toBe(output));

  it('keeps ordinary messages', () => {
    for (const text of [
      "TypeError: Cannot read properties of undefined (reading 'items')",
      'Request failed at 2026-10-26 18:00:00 with 500',
      'NetworkError when attempting to fetch resource.',
    ]) {
      expect(scrubText(text)).toBe(text);
    }
  });
});

describe('scrubEvent', () => {
  it('scrubs strings deep, keeps ids and stacks, drops user and headers', () => {
    const frames = [{ filename: 'app:///entry-80fd82bd0fad219c82a9ffd7c370309a.js', lineno: 1 }];
    expect(
      scrubEvent({
        event_id: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
        message: 'Saved for דנה',
        user: { id: 'u1', email: 'a@b.co' },
        request: { url: 'https://x/j/Zx81kQp0aLm2Nn3Bb4Vv5Cc6', headers: { authorization: 'x' } },
        exception: { values: [{ value: 'dana@example.com not found', stacktrace: { frames } }] },
        contexts: { trace: { trace_id: '0123456789abcdef0123456789abcdef', op: 'nav' } },
        breadcrumbs: [{ message: 'tap', data: { label: 'טיול לאילת', count: 3 } }],
      }),
    ).toEqual({
      event_id: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
      message: 'Saved for [he]',
      request: { url: 'https://x/j/[token]' },
      exception: { values: [{ value: '[email] not found', stacktrace: { frames } }] },
      contexts: { trace: { trace_id: '0123456789abcdef0123456789abcdef', op: 'nav' } },
      breadcrumbs: [{ message: 'tap', data: { label: '[he]', count: 3 } }],
    });
  });
});
