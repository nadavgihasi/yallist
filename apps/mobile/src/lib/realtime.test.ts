import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { backoff, CLIENT_ID, isOwnEvent, subscribe, watch } from './realtime';

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

  it('catches up once, 4 s after subscribing, while connected', () => {
    const { onSubscribed } = start();
    latest().accept();
    expect(onSubscribed).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(3999);
    expect(onSubscribed).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(onSubscribed).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(60_000);
    expect(onSubscribed).toHaveBeenCalledTimes(2);
  });

  it('catches up again after a reconnect', () => {
    const { onSubscribed } = start();
    latest().accept();
    vi.advanceTimersByTime(4000);
    latest().close();
    vi.advanceTimersByTime(1000);
    latest().accept();
    expect(onSubscribed).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(4000);
    expect(onSubscribed).toHaveBeenCalledTimes(4);
  });

  it('drops the catch-ups of a lost connection', () => {
    const { onSubscribed, stop } = start();
    latest().accept();
    latest().close();
    vi.advanceTimersByTime(999);
    expect(onSubscribed).toHaveBeenCalledTimes(1);
    stop();
    vi.advanceTimersByTime(60_000);
    expect(onSubscribed).toHaveBeenCalledTimes(1);
  });

  it('drops the catch-ups on unsubscribe, before the socket reports closing', () => {
    const { onSubscribed, stop } = start();
    latest().accept();
    // A browser fires close once the close handshake ends: late when the network is gone.
    latest().close = () => {};
    stop();
    vi.advanceTimersByTime(60_000);
    expect(onSubscribed).toHaveBeenCalledOnce();
  });

  it('reports each event, with its payload', () => {
    const { onEvent } = start();
    latest().accept();
    latest().receive({ type: 'ka' });
    latest().receive({ type: 'data', id: '1', event: '{"type":"changed"}' });
    latest().receive({ type: 'data', id: '1', event: '{"type":"changed","client":"c1"}' });
    latest().receive({ type: 'data', id: '1', event: 'not json' });
    expect(onEvent.mock.calls).toEqual([
      [{ type: 'changed' }],
      [{ type: 'changed', client: 'c1' }],
      [undefined],
    ]);
  });

  it('reports a refused subscription, then tries again', () => {
    const { onEvent } = start();
    latest().onopen?.();
    latest().receive({ type: 'connection_ack', connectionTimeoutMs: 60_000 });
    latest().receive({ type: 'subscribe_error', id: '1', errors: [] });
    expect(onEvent).toHaveBeenCalledExactlyOnceWith();
    expect(latest().closed).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.all).toHaveLength(2);
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

describe('watch', () => {
  const options = (channel: string) => ({
    host,
    channel,
    token: () => 'tok',
    onEvent: vi.fn(),
    onSubscribed: vi.fn(),
  });

  it('shares one subscription between watchers of a channel, until the last stops', () => {
    const trip = options('/trips/t1');
    const shop = options('/trips/t1');
    const stopTrip = watch(trip);
    const stopShop = watch(shop);
    expect(FakeSocket.all).toHaveLength(1);
    latest().accept();
    latest().receive({ type: 'data', id: '1', event: '{"type":"changed"}' });
    // The first watcher's callbacks, once per event.
    expect(trip.onEvent).toHaveBeenCalledOnce();
    expect(shop.onEvent).not.toHaveBeenCalled();

    stopShop();
    stopShop(); // twice is still one watcher fewer
    expect(latest().closed).toBe(false);
    stopTrip();
    expect(latest().closed).toBe(true);

    watch(options('/trips/t1'))();
    expect(FakeSocket.all).toHaveLength(2);
  });

  it('subscribes to each channel on its own', () => {
    const stops = [watch(options('/trips/t1')), watch(options('/trips/t2'))];
    expect(FakeSocket.all.map((ws) => ws.closed)).toEqual([false, false]);
    stops[0]!();
    expect(FakeSocket.all.map((ws) => ws.closed)).toEqual([true, false]);
    stops[1]!();
  });
});

describe('isOwnEvent', () => {
  it("is only this session's events", () => {
    expect(CLIENT_ID).toMatch(/^[0-9a-z]{20}$/);
    expect(isOwnEvent({ type: 'changed', tripId: 't1', client: CLIENT_ID })).toBe(true);
    // Another device or tab of the same user, an older API, a payload that isn't ours.
    expect(isOwnEvent({ type: 'changed', tripId: 't1', client: 'another' })).toBe(false);
    expect(isOwnEvent({ type: 'changed', tripId: 't1' })).toBe(false);
    for (const event of [undefined, null, 'changed', 1]) expect(isOwnEvent(event)).toBe(false);
  });
});

describe('backoff', () => {
  it('doubles up to 30 seconds', () => {
    expect([0, 1, 2, 4, 5, 10].map(backoff)).toEqual([1000, 2000, 4000, 16_000, 30_000, 30_000]);
  });
});
