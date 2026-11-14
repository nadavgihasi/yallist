import { claimsFor, filterItems, type Claim, type Item } from '@yallist/domain';

/**
 * The two views inside a tab, picked by the sub-tabs under it and kept in the URL (`?part=`).
 * The equipment tab opens on what the group shares, then my own list; money opens on the
 * expenses, then who pays whom. Plain data, so it's testable without React Native.
 */
export const BRING_PARTS = ['shared', 'mine'] as const;
export type BringPart = (typeof BRING_PARTS)[number];
export const MONEY_PARTS = ['expenses', 'settle'] as const;
export type MoneyPart = (typeof MONEY_PARTS)[number];

/** The URL's part for that tab, or the tab's first. */
export const bringPart = (param?: string): BringPart =>
  BRING_PARTS.find((p) => p === param) ?? 'shared';
export const moneyPart = (param?: string): MoneyPart =>
  MONEY_PARTS.find((p) => p === param) ?? 'expenses';

/** What the group shares: everything but "everyone brings their own" items. */
export const sharedItems = <T extends Item>(items: readonly T[]): T[] =>
  items.filter((i) => i.kind !== 'each');

/** My own list: every "each" item, and the shared items I took. */
export const myItems = <T extends Item>(
  items: readonly T[],
  claims: readonly Claim[],
  me: string,
): T[] => filterItems(items, 'mine', claims, [], [], me) as T[];

/** How many of my items I packed: my claim on it is in the bag. */
export const myPackedCount = (items: readonly Item[], claims: readonly Claim[], me: string) =>
  items.filter((i) => claimsFor(i.id, claims).some((c) => c.userId === me && c.packed)).length;

/** The equipment view that shows `item`: an "each" item is only on my list. */
export const partOf = (item: Pick<Item, 'kind'>): BringPart =>
  item.kind === 'each' ? 'mine' : 'shared';
