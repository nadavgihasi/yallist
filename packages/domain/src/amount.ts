/**
 * How much of a buy item to get: a number and an optional unit (`2 ק״ג`, `1.5 ליטר`, `40`).
 * Stored as the item's `displayQty` text, the same text the built-in templates use, so every
 * screen that shows `displayQty` shows it as is.
 */
export const BUY_UNITS = ['יח׳', 'ק״ג', 'גרם', 'ליטר', 'חבילה'] as const;

/** Units that come in fractions; the others are counted in whole numbers. */
const DECIMAL_UNITS: ReadonlySet<string> = new Set(['ק״ג', 'ליטר']);

/** The largest amount the form takes. */
export const BUY_AMOUNT_MAX = 9999;

/** The API's limit on `displayQty`. */
const MAX_TEXT = 20;

export interface BuyAmount {
  /** As typed: digits, with `.` or `,` for a fraction. */
  amount: string;
  unit?: string;
}

// Other ways to write a unit, as typed or pasted (`ק"ג`, `קילו`, `kg`, `גר'`), and the plural
// a chip's unit takes after a number other than 1.
const SPELLINGS: readonly (readonly [RegExp, string])[] = [
  [/^(?:ק["״”]?ג|קילו(?:גרם)?|kg)$/i, 'ק״ג'],
  [/^(?:גרם|גר['׳’]?|ג['׳’]|gr?)$/i, 'גרם'],
  [/^(?:ליטר(?:ים)?|ל['׳’]|l)$/i, 'ליטר'],
  [/^(?:מ["״”]?ל|ml)$/i, 'מ״ל'],
  [/^(?:יח['׳’]?|יחידה|יחידות)$/, 'יח׳'],
  [/^חבילות$/, 'חבילה'],
];

/**
 * A unit spelled one way everywhere, the way the unit chips are: `ק"ג`, `קילו` and `kg` are
 * `ק״ג`. The bulk parser stores this spelling, and the form reads it back as its chip.
 */
export function canonicalUnit(unit: string): string {
  const trimmed = unit.trim();
  const known = SPELLINGS.find(([spelling]) => spelling.test(trimmed));
  return known ? known[1] : trimmed.replace(/["”]/g, '״').replace(/['’]/g, '׳');
}

/**
 * An item's `displayQty` back as an amount and unit, to edit it. Text that isn't a number and a
 * unit (`2-3 ק״ג`, written through the API) comes back whole as the amount, as it was written.
 */
export function parseBuyAmount(text: string | undefined): BuyAmount {
  const trimmed = text?.trim() ?? '';
  const match = /^(\d+(?:[.,]\d+)?)(?:\s*(\p{L}[\p{L}\p{M}'"׳״”’ ]*))?$/u.exec(trimmed);
  if (!match) return { amount: trimmed };
  return match[2] ? { amount: match[1]!, unit: canonicalUnit(match[2]) } : { amount: match[1]! };
}

/**
 * The `displayQty` for an amount and unit: null when neither was given, undefined when it isn't
 * a valid amount (a unit without a number, not a positive number up to `BUY_AMOUNT_MAX`, a
 * fraction of a unit counted whole, or too long).
 */
export function buyAmountText({ amount, unit }: BuyAmount): string | null | undefined {
  const trimmed = amount.trim().replace(',', '.');
  if (!trimmed) return unit ? undefined : null;
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  if (value <= 0) return undefined;
  if (!Number.isInteger(value) && !allowsFraction(unit)) return undefined;
  // `1 חבילה`, `2 חבילות`.
  const shown = unit === 'חבילה' && value !== 1 ? 'חבילות' : unit;
  const text = shown ? `${value} ${shown}` : String(value);
  return text.length <= MAX_TEXT ? text : undefined;
}

/** Whether the unit takes a fraction, such as `1.5 ק״ג`. */
export const allowsFraction = (unit: string | undefined) => !!unit && DECIMAL_UNITS.has(unit);
