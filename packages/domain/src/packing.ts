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
 * (`each`: one of those everyone brings their own of), something I bought, or a private item,
 * which is `essential` when it's one of my essentials.
 */
export type BagSource = 'list' | 'each' | 'bought' | 'essential' | 'private';

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
 * `essentialNames`: the user's essentials, which private items of the same name (ignoring case)
 * came from.
 */
export function myBag(
  userId: string,
  items: readonly Item[],
  claims: readonly Claim[],
  boughtItemIds: ReadonlySet<string>,
  essentialNames: readonly string[] = [],
): { group: BagEntry[]; mine: BagEntry[]; packed: number; total: number } {
  const essentials = new Set(essentialNames.map(nameKey));
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
      if (item.privateOwnerId === userId) {
        mine.push(entry(essentials.has(nameKey(item.name)) ? 'essential' : 'private'));
      }
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

/** Names compare ignoring case and the spaces around them. */
const nameKey = (name: string) => name.trim().toLowerCase();

/**
 * "אולי גם": up to 3 things I had in my bag on past trips (`pastPrivateItemNames`, repeats
 * included) that this trip doesn't have yet and that aren't among my essentials, which arrive by
 * themselves. Most frequent first; ties keep the order given.
 */
export function suggestions(
  currentTripItems: readonly Item[],
  pastPrivateItemNames: readonly string[],
  essentialNames: readonly string[] = [],
): string[] {
  const taken = new Set([...currentTripItems.map((i) => i.name), ...essentialNames].map(nameKey));
  const counts = new Map<string, { name: string; count: number }>();
  for (const name of pastPrivateItemNames) {
    const k = nameKey(name);
    if (taken.has(k)) continue;
    const seen = counts.get(k);
    if (seen) seen.count++;
    else counts.set(k, { name: name.trim(), count: 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((s) => s.name);
}
