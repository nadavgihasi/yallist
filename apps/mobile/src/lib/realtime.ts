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
  /** An event arrived on the channel. */
  onEvent: () => void;
  /** Subscribed, first or after a reconnect: events may have been missed while away. */
  onSubscribed: () => void;
}

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
          return onSubscribed();
        case 'data':
          return onEvent();
        default:
          // connection_error, subscribe_error (e.g. no longer a member), error.
          return reconnect();
      }
    };
  };

  connect();
  return () => {
    stopped = true;
    clearTimeout(retry);
    socket?.close();
  };
}
