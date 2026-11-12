import {
  allowsFraction,
  buyAmountText,
  parseBuyAmount,
  type BuyAmount,
  type CatalogItem,
  type Item,
} from '@yallist/domain';

import { he } from '@/i18n/he';

/** The unit a counted amount gets, such as a catalog entry's `*6` or an older quantity item. */
const PIECES = 'יח׳';

/**
 * What the buy form starts with: the item's amount text, or an older quantity item's count. A new
 * item starts empty.
 */
export function initialBuyAmount(item: Item | undefined): BuyAmount {
  if (item?.list === 'buy' && item.kind === 'qty' && !item.displayQty) {
    return { amount: String(item.quantityNeeded), unit: item.unit ?? PIECES };
  }
  return parseBuyAmount(item?.list === 'buy' ? item.displayQty : undefined);
}

/** A catalog suggestion's default count as an amount (`*6` → 6 יח׳); undefined when it has none. */
export function catalogBuyAmount(entry: CatalogItem): BuyAmount | undefined {
  return entry.kind === 'qty' ? { amount: String(entry.quantityNeeded), unit: PIECES } : undefined;
}

/**
 * How a buy item is counted once saved from the form: one item for the group, with the amount as
 * its text. An existing per-person or quantity item someone already claimed keeps its kind: the
 * API refuses to change a claimed item's kind.
 */
export function buyItemFields(
  item: Item | undefined,
  claimed: boolean,
  displayQty: string | null,
): Pick<Item, 'kind' | 'quantityNeeded'> & { displayQty: string | null } {
  if (item && item.kind !== 'single' && claimed) {
    return { kind: item.kind, quantityNeeded: item.quantityNeeded, displayQty };
  }
  return { kind: 'single', quantityNeeded: 1, displayQty };
}

/** Why the amount can't be saved, if it can't. */
export function buyAmountError(value: BuyAmount): string | undefined {
  if (buyAmountText(value) !== undefined) return undefined;
  const fraction = /^\d+[.,]\d+$/.test(value.amount.trim());
  return fraction && !allowsFraction(value.unit) ? he.addItem.wholeAmount : he.addItem.badAmount;
}
