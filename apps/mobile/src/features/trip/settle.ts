import { parseShekel } from '@yallist/domain';

import { he } from '@/i18n/he';

/** "+972501234567" → "0501234567": what Bit and PayBox take when it's pasted. */
export const localPhone = (e164: string) => `0${e164.replace(/^\+972/, '')}`;

/**
 * A payment of part of what I owe someone, as typed: its agorot, or why it can't be marked.
 * Up to what's owed: more than that would turn the debt around.
 */
export function partialAmount(
  text: string,
  owed: number,
): { agorot: number; error?: undefined } | { agorot?: undefined; error?: string } {
  if (!text.trim()) return {};
  const agorot = parseShekel(text);
  if (agorot === undefined) return { error: he.invalidAmount };
  if (agorot > owed) return { error: he.settle.overOwed };
  return { agorot };
}
