import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { backoff, subscribe } from './realtime';

/** A WebSocket the test drives: `receive` plays the server, `sent` is what the client sent. */
class FakeSocket {
  static all: FakeSocket[] = [];
  sent: { type: string; [key: string]: unknown }[] = [];
  closed = false;
  onopen?: () => void;
  onclose?: () => void;
  onmessage?: (event: { data: string }) => void;
  constructor(
    readonly url: string,
    readonly protocols: string[],
  ) {
    FakeSocket.all.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data) as FakeSocket['sent'][number]);
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.();
  }
  receive(message: object) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  /** Opens and acknowledges the connection, then confirms the subscription. */
  accept() {
    this.onopen?.();
    this.receive({ type: 'connection_ack', connectionTimeoutMs: 60_000 });
    this.receive({ type: 'subscribe_success', id: '1' });
  }
}

const host = 'abc.appsync-realtime-api.us-east-2.amazonaws.com';
const latest = () => FakeSocket.all.at(-1)!;

function start() {
  const onEvent = vi.fn();
  const onSubscribed = vi.fn();
  const stop = subscribe({
    host,
    channel: '/trips/t1',
    token: () => 'tok',
    onEvent,
    onSubscribed,
  });
  return { onEvent, onSubscribed, stop };
}

beforeEach(() => {
  FakeSocket.all = [];
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(1); // no jitter
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('subscribe', () => {
  it('connects and subscribes with the session token for the HTTP host', () => {
    const { onSubscribed } = start();
    const ws = latest();
    expect(ws.url).toBe(`wss://${host}/event/realtime`);
    const authorization = { host: 'abc.appsync-api.us-east-2.amazonaws.com', Authorization: 'tok' };
    const header = ws.protocols[1]!.replace('header-', '').replace(/-/g, '+').replace(/_/g, '/');
    expect(JSON.parse(atob(header))).toEqual(authorization);
    expect(ws.protocols[0]).toBe('aws-appsync-event-ws');

    ws.accept();
    expect(ws.sent).toEqual([
      { type: 'connection_init' },
      { type: 'subscribe', id: '1', channel: '/trips/t1', authorization },
    ]);
    expect(onSubscribed).toHaveBeenCalledOnce();
  });

  it('reports each event', () => {
    const { onEvent } = start();
    latest().accept();
    latest().receive({ type: 'ka' });
    latest().receive({ type: 'data', id: '1', event: '{"type":"changed"}' });
    latest().receive({ type: 'data', id: '1', event: '{"type":"changed"}' });
    expect(onEvent).toHaveBeenCalledTimes(2);
  });

  it('reconnects with growing delays, resetting once subscribed', () => {
    const { onSubscribed } = start();
    latest().close();
    vi.advanceTimersByTime(999);
    expect(FakeSocket.all).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.all).toHaveLength(2);

    latest().receive({ type: 'connection_error', errors: [] });
    vi.advanceTimersByTime(2000);
    expect(FakeSocket.all).toHaveLength(3);

    latest().accept();
    expect(onSubscribed).toHaveBeenCalledOnce();
    latest().close();
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.all).toHaveLength(4);
  });

  it('reconnects when keep-alives stop', () => {
    start();
    latest().accept();
    vi.advanceTimersByTime(59_000);
    latest().receive({ type: 'ka' });
    vi.advanceTimersByTime(59_000);
    expect(latest().closed).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.all[0]!.closed).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.all).toHaveLength(2);
  });

  it('stops for good when unsubscribed', () => {
    const { stop } = start();
    latest().accept();
    stop();
    expect(latest().closed).toBe(true);
    vi.advanceTimersByTime(600_000);
    expect(FakeSocket.all).toHaveLength(1);
  });
});

describe('backoff', () => {
  it('doubles up to 30 seconds', () => {
    expect([0, 1, 2, 4, 5, 10].map(backoff)).toEqual([1000, 2000, 4000, 16_000, 30_000, 30_000]);
  });
});
