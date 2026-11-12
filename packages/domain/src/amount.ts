/**
 * How much of a buy item to get: a number and an optional unit (`2 ק״ג`, `1.5 ליטר`, `40`).
 * Stored as the item's `displayQty` text, the same text the built-in templates use, so every
 * screen that shows `displayQty` shows it as is.
 */
export const BUY_UNITS = ['יח׳', 'ק״ג', 'גרם', 'ליטר', 'חבילה'] as const;

/** Units that come in fractions; the others are counted in whole numbers. */
const DECIMAL_UNITS: ReadonlySet<string> = new Set(['ק״ג', 'ליטר']);

/** The API's limit on `displayQty`. */
const MAX_TEXT = 20;

export interface BuyAmount {
  /** As typed: digits, with `.` or `,` for a fraction. */
  amount: string;
  unit?: string;
}

/** `ק"ג` and `יח'` as typed on a keyboard, spelled the way the unit chips are. */
function normalizeUnit(unit: string): string {
  return unit.trim().replace(/"/g, '״').replace(/'/g, '׳');
}

/**
 * An item's `displayQty` back as an amount and unit, to edit it. Text that doesn't start with a
 * number (only possible through the API) comes back whole as the amount, so it shows as invalid
 * rather than being dropped.
 */
export function parseBuyAmount(text: string | undefined): BuyAmount {
  const trimmed = text?.trim() ?? '';
  const match = /^(\d+(?:[.,]\d+)?)\s*(.*)$/.exec(trimmed);
  if (!match) return { amount: trimmed };
  const unit = normalizeUnit(match[2]!);
  return unit ? { amount: match[1]!, unit } : { amount: match[1]! };
}

/**
 * The `displayQty` for an amount and unit: null when no amount was given, undefined when it isn't
 * a valid amount (not a positive number, a fraction of a unit counted whole, or too long).
 */
export function buyAmountText({ amount, unit }: BuyAmount): string | null | undefined {
  const trimmed = amount.trim().replace(',', '.');
  if (!trimmed) return null;
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(trimmed)) return undefined;
  const value = Number(trimmed);
  if (value <= 0) return undefined;
  if (!Number.isInteger(value) && !(unit && DECIMAL_UNITS.has(unit))) return undefined;
  const text = unit ? `${value} ${unit}` : String(value);
  return text.length <= MAX_TEXT ? text : undefined;
}

/** Whether the unit takes a fraction, such as `1.5 ק״ג`. */
export const allowsFraction = (unit: string | undefined) => !!unit && DECIMAL_UNITS.has(unit);
