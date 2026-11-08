import * as Sentry from '@sentry/node-core/light';
import { Hono } from 'hono';
import { afterAll, beforeAll, expect, test } from 'vitest';

import { tracing } from './sentry';

const sent: Sentry.Event[] = [];

beforeAll(() => {
  Sentry.init({
    dsn: 'https://public@sentry.example/1',
    tracesSampleRate: 1,
    transport: () => Sentry.createTransport({ recordDroppedEvent: () => {} }, async () => ({})),
    beforeSendTransaction: (event) => {
      sent.push(event);
      return null;
    },
  });
});
afterAll(() => Sentry.close());

test('names the span by the route pattern and continues the incoming trace', async () => {
  const app = new Hono().use(tracing()).get('/trips/:tripId', (c) => c.json({ ok: true }));
  const traceId = '0af7651916cd43dd8448eb211c80319c';
  const res = await app.request('/trips/123e4567-e89b-12d3-a456-426614174000', {
    headers: { 'sentry-trace': `${traceId}-b7ad6b7169203331-1` },
  });
  expect(res.status).toBe(200);
  expect(sent).toHaveLength(1);
  expect(sent[0]!.transaction).toBe('GET /trips/:tripId');
  expect(sent[0]!.contexts?.trace?.trace_id).toBe(traceId);
  expect(sent[0]!.contexts?.trace?.status).toBe('ok');
});
