/**
 * Error reports (Sentry, apps/mobile and apps/api) carry no personal data. Text is scrubbed of
 * what could identify someone or let a reader in: bearer, Telegram bot and other tokens, emails,
 * Israeli phone numbers, and Hebrew text (names, trip and item titles; errors are in English).
 */
const PATTERNS: [RegExp, string][] = [
  [/Bearer\s+\S+/gi, 'Bearer [token]'],
  [/\bbot\d+:[\w-]+/g, 'bot[token]'],
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]'],
  [/(?:\+972[\s-]?|\b0)5\d(?:[\s-]?\d){7}\b/g, '[phone]'],
  // Session and invite tokens, ids: long runs of letters and digits with both in them.
  [/\b(?=[\w-]*\d)(?=[\w-]*[A-Za-z])[\w-]{20,}\b/g, '[token]'],
  [/[֐-׿]+(?:[\s'"׳״-]+[֐-׿]+)*/g, '[he]'],
];

export const scrubText = (text: string) =>
  PATTERNS.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);

/** Keys kept as they are: ids that link events and traces, and what symbolicates a stack. */
const KEEP = new Set([
  'event_id',
  'trace_id',
  'span_id',
  'parent_span_id',
  'release',
  'dist',
  'environment',
  'sdk',
  'debug_meta',
  'stacktrace',
]);
/** Keys dropped: who the user is, and request parts that hold credentials. */
const DROP = new Set(['user', 'cookies', 'headers', 'ip_address']);

/**
 * A Sentry event (or breadcrumb, or transaction) with every string scrubbed (scrubText), except
 * under KEEP, and without user, cookies and headers. Use as beforeSend and beforeBreadcrumb.
 */
export function scrubEvent<T>(event: T): T {
  return scrub(event) as T;
}

function scrub(value: unknown): unknown {
  if (typeof value === 'string') return scrubText(value);
  if (Array.isArray(value)) return value.map(scrub);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !DROP.has(key))
      .map(([key, child]) => [key, KEEP.has(key) ? child : scrub(child)]),
  );
}
