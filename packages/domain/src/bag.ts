import { itemKey, sameItem } from './catalog';
import { claimsFor } from './coverage';
import type { BagItem, Claim, Item } from './types';

/** The bag's item for a trip item: the same item by name (the catalog knows its other names). */
export const bagItemFor = (bag: readonly BagItem[], name: string) =>
  bag.find((b) => sameItem(b.name, name));

export interface BagSuggestion {
  item: Item;
  /** What taking it claims: all of it, or for a qty item, as many as the bag has. */
  quantity: number;
}

/**
 * Common bring items that are in my bag and that nobody brings yet: the trip offers to put them
 * on me. Never one someone already took, even in part. Per-person items need no offer: the bag
 * marks those by itself.
 */
export function bagSuggestions(
  items: readonly Item[],
  claims: readonly Claim[],
  bag: readonly BagItem[],
): BagSuggestion[] {
  return items.flatMap((item) => {
    const mine = bagItemFor(bag, item.name);
    if (!mine || item.list !== 'bring' || item.kind === 'each') return [];
    if (claimsFor(item.id, claims).length > 0) return [];
    const quantity = item.kind === 'qty' ? Math.min(mine.quantity, item.quantityNeeded) : 1;
    return [{ item, quantity }];
  });
}

/**
 * What I brought on the trip that isn't in my bag yet, once per name: per-person items I said I
 * have, and common items I took. The end of the trip offers to add them, so next time they're
 * marked by themselves.
 */
export function broughtNotInBag(
  items: readonly Item[],
  claims: readonly Claim[],
  bag: readonly BagItem[],
  me: string,
): { name: string; quantity: number }[] {
  const seen = new Set(bag.map((b) => itemKey(b.name)));
  return items.flatMap((item) => {
    const claim = claims.find((c) => c.itemId === item.id && c.userId === me);
    if (!claim || claim.fromBag || item.list !== 'bring' || seen.has(itemKey(item.name))) return [];
    seen.add(itemKey(item.name));
    return [{ name: item.name, quantity: item.kind === 'each' ? 1 : claim.quantity }];
  });
}
