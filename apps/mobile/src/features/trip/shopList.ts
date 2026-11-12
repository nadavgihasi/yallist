import { runSummary, type Category, type Claim, type Item } from '@yallist/domain';

interface ShopGroup {
  /** Absent: items without a (known) category. */
  category?: Category;
  items: Item[];
}

/**
 * The in-store checklist: what's still to pick up, by category in the buy list's order
 * (uncategorized last), then what's already in the cart, which sinks to its own section.
 * `claims`: the run's claims. Items no longer on the list drop out.
 */
export function shopList(
  claims: readonly Claim[],
  items: readonly Item[],
  categories: readonly Category[],
): { groups: ShopGroup[]; inCart: Item[] } {
  const { inCart, notInCart } = runSummary(claims, items);
  const ordered = categories
    .filter((c) => c.list === 'buy')
    .sort((a, b) => a.position - b.position);
  const known = new Set(ordered.map((c) => c.id));
  const groups = [...ordered, undefined]
    .map((category) => ({
      category,
      items: notInCart.filter((i) =>
        category ? i.categoryId === category.id : !i.categoryId || !known.has(i.categoryId),
      ),
    }))
    .filter((g) => g.items.length > 0);
  return { groups, inCart };
}
