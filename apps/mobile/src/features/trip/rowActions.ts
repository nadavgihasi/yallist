import { claimCap, type Claim, type Item, type ItemStatus } from '@yallist/domain';

/** Still missing something: the row's ring is dashed. */
const OPEN: readonly ItemStatus['kind'][] = ['missing', 'partial', 'each'];

/**
 * What tapping the dashed ring of a row claims for me, or undefined when the ring isn't a claim
 * control (I already have a share, nothing is missing, or it's bought). The same claim as the
 * row's button: the whole item, one unit of a qty item (the stepper's +), or "יש לי" on a
 * per-person item.
 */
export function ringClaim(
  item: Item,
  status: ItemStatus,
  claims: readonly Claim[],
  me: string,
): number | undefined {
  if (!OPEN.includes(status.kind)) return undefined;
  if (claims.some((c) => c.itemId === item.id && c.userId === me)) return undefined;
  if (claimCap(item, claims, me) <= 0) return undefined;
  return item.kind === 'single' ? item.quantityNeeded : 1;
}

/** A row's note on one line: whitespace and line breaks collapsed, cut at `max` characters. */
export function noteLine(note: string | undefined, max = 60): string | undefined {
  const line = note?.replace(/\s+/g, ' ').trim();
  if (!line) return undefined;
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}
