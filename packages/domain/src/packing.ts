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

/**
 * The bring list's progress card: how many items are covered, and how many of those packed.
 * Private items don't count.
 */
export function listProgress(
  items: readonly Item[],
  claims: readonly Claim[],
  activeIds: readonly string[],
) {
  const statuses = items
    .filter((i) => !i.privateOwnerId)
    .map((i) => packingStatus(i, claims, activeIds).status);
  return {
    covered: statuses.filter((s) => s !== 'missing').length,
    total: statuses.length,
    packed: statuses.filter((s) => s === 'packed').length,
  };
}

/** A claim changed to `quantity`: claiming more takes it out of the bag, claiming less doesn't. */
export function withQuantity(claim: Claim, quantity: number): Claim {
  return { ...claim, quantity, packed: quantity > claim.quantity ? false : claim.packed };
}

/**
 * Where an entry in my bag comes from, for its label: something I took from the bring list
 * (`each`: one of those everyone brings their own of), something I bought, or a private item.
 */
export type BagSource = 'list' | 'each' | 'bought' | 'private';

export interface BagEntry {
  item: Item;
  /** My claim's quantity: `×4` for a qty item. */
  quantity: number;
  packed: boolean;
  source: BagSource;
}

/**
 * Everything `userId` physically brings (התיק שלי): `group`, their claims on shared items (every
 * bring item, and buy items once bought; an unbought buy claim stays on the buy list), and
 * `mine`, their private items. Unpacked first, then in list order (bring, then buy).
 */
export function myBag(
  userId: string,
  items: readonly Item[],
  claims: readonly Claim[],
  boughtItemIds: ReadonlySet<string>,
): { group: BagEntry[]; mine: BagEntry[]; packed: number; total: number } {
  const group: BagEntry[] = [];
  const mine: BagEntry[] = [];
  for (const item of items) {
    const claim = claims.find((c) => c.itemId === item.id && c.userId === userId);
    const entry = (source: BagSource): BagEntry => ({
      item,
      quantity: claim?.quantity ?? 1,
      packed: !!claim?.packed,
      source,
    });
    if (item.privateOwnerId) {
      if (item.privateOwnerId === userId) mine.push(entry('private'));
    } else if (claim && item.list === 'bring') {
      group.push(entry(item.kind === 'each' ? 'each' : 'list'));
    } else if (claim && boughtItemIds.has(item.id)) {
      group.push(entry('bought'));
    }
  }
  const order = (a: BagEntry, b: BagEntry) =>
    Number(a.packed) - Number(b.packed) ||
    a.item.list.localeCompare(b.item.list) ||
    a.item.position - b.item.position;
  const all = [...group, ...mine];
  return {
    group: group.sort(order),
    mine: mine.sort(order),
    packed: all.filter((e) => e.packed).length,
    total: all.length,
  };
}
