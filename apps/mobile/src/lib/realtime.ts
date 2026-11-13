/**
 * The realtime API's host (AppSync Events, `<id>.appsync-realtime-api.<region>.amazonaws.com`),
 * set at build time by SST (`infra/app/core.ts`). Unset locally and in the local UI tests,
 * which have no AppSync: then nothing subscribes and screens refresh as before.
 */
export const REALTIME_HOST = process.env.EXPO_PUBLIC_REALTIME_URL || undefined;

const MAX_DELAY_MS = 30_000;

/** Reconnect delay after `attempt` failures in a row: 1 s doubling to 30 s, with jitter. */
export const backoff = (attempt: number) =>
  Math.min(MAX_DELAY_MS, 1000 * 2 ** attempt) * (0.5 + Math.random() / 2);

interface Options {
  host: string;
  /** e.g. `/trips/<tripId>` (apps/api/src/realtime.ts). */
  channel: string;
  /** The session token, read on every (re)connect. */
  token: () => string | undefined;
  /**
   * An event arrived on the channel, or subscribing was refused (no longer a member, say a trip
   * deleted before we subscribed): either way, the screen should refetch to find out.
   */
  onEvent: () => void;
  /**
   * Subscribed, first or after a reconnect: events may have been missed while away. Told again
   * at each of `CATCH_UP_MS` after it, while still connected.
   */
  onSubscribed: () => void;
}

/**
 * `subscribe_success` doesn't mean every event reaches us yet: for a few seconds after it, AppSync
 * Events can drop what is published to the channel (it accepted every publish; on a preview, about
 * 1 in 7 subscriptions under a second old missed one, and some up to 3.2 s old). So a new
 * subscription also refetches 2, 5 and 10 s in: a change in that window shows by then.
 */
const CATCH_UP_MS = [2000, 5000, 10_000];

const base64Url = (text: string) =>
  btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * Subscribes to one channel over the AppSync Events WebSocket protocol, reconnecting with
 * backoff when the socket closes, errors or misses its keep-alives. Returns the unsubscribe.
 * https://docs.aws.amazon.com/appsync/latest/eventapi/event-api-websocket-protocol.html
 */
export function subscribe({ host, channel, token, onEvent, onSubscribed }: Options): () => void {
  // The authorization names the API's HTTP host, not the realtime one (docs/deploy.md).
  const httpHost = host.replace('appsync-realtime-api', 'appsync-api');
  let socket: WebSocket | undefined;
  let failures = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  // Cleared by the unsubscribe itself, not only by the close event, which a browser fires only
  // once the close handshake ends: late when the network is gone, after we left the trip.
  let catchUps: ReturnType<typeof setTimeout>[] = [];

  const connect = () => {
    const authorization = { host: httpHost, Authorization: token() ?? '' };
    const ws = new WebSocket(`wss://${host}/event/realtime`, [
      'aws-appsync-event-ws',
      `header-${base64Url(JSON.stringify(authorization))}`,
    ]);
    socket = ws;
    let timeoutMs = 300_000;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const alive = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(reconnect, timeoutMs);
    };
    function reconnect() {
      if (socket !== ws) return;
      socket = undefined;
      clearTimeout(watchdog);
      catchUps.forEach(clearTimeout);
      ws.close();
      if (!stopped) retry = setTimeout(connect, backoff(failures++));
    }

    ws.onopen = () => ws.send(JSON.stringify({ type: 'connection_init' }));
    ws.onclose = reconnect;
    ws.onmessage = ({ data }) => {
      const message = JSON.parse(String(data)) as { type: string; connectionTimeoutMs?: number };
      switch (message.type) {
        case 'connection_ack':
          timeoutMs = message.connectionTimeoutMs ?? timeoutMs;
          alive();
          ws.send(JSON.stringify({ type: 'subscribe', id: '1', channel, authorization }));
          return;
        case 'ka':
          return alive();
        case 'subscribe_success':
          failures = 0;
          catchUps = CATCH_UP_MS.map((ms) => setTimeout(onSubscribed, ms));
          return onSubscribed();
        case 'data':
          return onEvent();
        case 'subscribe_error':
          onEvent();
          return reconnect();
        default:
          // connection_error, error.
          return reconnect();
      }
    };
  };

  connect();
  return () => {
    stopped = true;
    clearTimeout(retry);
    catchUps.forEach(clearTimeout);
    socket?.close();
  };
}
