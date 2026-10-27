import { claimsFor, isCovered } from './coverage';
import type { Claim, Item } from './types';

export type Packing = 'missing' | 'covered' | 'packed';

/**
 * Whether an item is still missing, covered, or covered and in every claimer's bag, with the
 * counts for "ארזו 2 מתוך 3". An "each" item counts only active members' claims.
 */
export function packingStatus(
  item: Item,
  claims: readonly Claim[],
  activeIds: readonly string[],
): { status: Packing; packedCount: number; claimCount: number } {
  const counted = claimsFor(item.id, claims).filter(
    (c) => item.kind !== 'each' || activeIds.includes(c.userId),
  );
  const packedCount = counted.filter((c) => c.packed).length;
  const claimCount = counted.length;
  const status = !isCovered(item, claims, activeIds)
    ? 'missing'
    : packedCount === claimCount
      ? 'packed'
      : 'covered';
  return { status, packedCount, claimCount };
}

/** The bring list's progress card: how many items are covered, and how many of those packed. */
export function listProgress(
  items: readonly Item[],
  claims: readonly Claim[],
  activeIds: readonly string[],
) {
  const statuses = items.map((i) => packingStatus(i, claims, activeIds).status);
  return {
    covered: statuses.filter((s) => s !== 'missing').length,
    total: items.length,
    packed: statuses.filter((s) => s === 'packed').length,
  };
}

/** A claim changed to `quantity`: claiming more takes it out of the bag, claiming less doesn't. */
export function withQuantity(claim: Claim, quantity: number): Claim {
  return { ...claim, quantity, packed: quantity > claim.quantity ? false : claim.packed };
}
