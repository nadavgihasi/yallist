/**
 * The realtime API's host (AppSync Events, `<id>.appsync-realtime-api.<region>.amazonaws.com`),
 * set at build time by SST (`infra/app/core.ts`). Unset locally and in the local UI tests,
 * which have no AppSync: then nothing subscribes and screens refresh as before.
 */
export const REALTIME_HOST = process.env.EXPO_PUBLIC_REALTIME_URL || undefined;

/**
 * This app session, as the API names it in the events of the changes it makes (header
 * `CLIENT_HEADER`, apps/api/src/realtime.ts): random per launch and per tab, so a second device
 * or tab of the same user still hears them. Not the user's id, nor anything else about them.
 */
export const CLIENT_ID = Array.from({ length: 20 }, () =>
  Math.floor(Math.random() * 36).toString(36),
).join('');
export const CLIENT_HEADER = 'x-yallist-client';

/**
 * Whether an event is the echo of a change this session made: its own refetch (the change's
 * `onSettled`) already shows it. Events without a `client` (an older API, a bag change, a join)
 * are never ours.
 */
export const isOwnEvent = (event: unknown) =>
  typeof event === 'object' && event !== null && 'client' in event && event.client === CLIENT_ID;

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
   * An event arrived on the channel (`event`, its parsed payload; undefined if it isn't JSON),
   * or subscribing was refused (no longer a member, say a trip deleted before we subscribed;
   * no `event`): either way, the screen should refetch to find out.
   */
  onEvent: (event?: unknown) => void;
  /**
   * Subscribed, first or after a reconnect: events may have been missed while away. Told again
   * at each of `CATCH_UP_MS` after it, while still connected.
   */
  onSubscribed: () => void;
}

/**
 * `subscribe_success` doesn't mean every event reaches us yet: for a few seconds after it, AppSync
 * Events can drop what is published to the channel. Measured on a preview (#184), with AppSync
 * accepting every publish: 21 of 154 subscriptions under a second old missed the event (about 1
 * in 7), 6 of 38 at 1-2 s, 2 of 40 at 2-3 s, and one 3.2 s old; none of the 10 at 3-5 s, too few
 * to call it safe. A socket that had just received one event could also miss the next. So a new
 * subscription refetches again 4 s in, past every miss seen, and 10 s in, for the rare late one.
 * Each costs one trip GET per (re)subscription: catch-ups refetch only the trip, not the home
 * list. (Was 2, 5 and 10 s, each also refetching the home list.)
 */
const CATCH_UP_MS = [4000, 10_000];

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
      const message = JSON.parse(String(data)) as {
        type: string;
        connectionTimeoutMs?: number;
        event?: string;
      };
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
          return onEvent(parseEvent(message.event));
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

/** An event's payload: JSON in a string. Anything else still counts as an event. */
function parseEvent(event: string | undefined): unknown {
  try {
    return event === undefined ? undefined : JSON.parse(event);
  } catch {
    return undefined;
  }
}

/** The channels subscribed to, each with how many watchers share it. */
const shared = new Map<string, { watchers: number; stop: () => void }>();

/**
 * `subscribe`, shared: screens that watch the same channel at once (the trip, and the shop run
 * opened over it) share one subscription, with the first watcher's callbacks; it ends when the
 * last one stops. So pass callbacks that don't depend on which screen calls.
 */
export function watch(options: Options): () => void {
  const { channel } = options;
  let entry = shared.get(channel);
  if (!entry) {
    entry = { watchers: 0, stop: subscribe(options) };
    shared.set(channel, entry);
  }
  const mine = entry;
  mine.watchers++;
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    if (--mine.watchers > 0) return;
    shared.delete(channel);
    mine.stop();
  };
}
