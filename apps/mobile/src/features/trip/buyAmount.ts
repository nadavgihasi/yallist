import {
  allowsFraction,
  BUY_AMOUNT_MAX,
  buyAmountText,
  parseBuyAmount,
  type BuyAmount,
  type Item,
  type ListKind,
} from '@yallist/domain';

import { he } from '@/i18n/he';
import type { NewItemInput } from '@/state/reducer';

/** The unit an older quantity item's count gets. */
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

/**
 * The amount text the buy form saves: the item's own text while the amount wasn't changed, so
 * text the form doesn't write (`2-3 ק״ג`, `2.5 גרם`) stays as it is and doesn't block saving
 * other changes; otherwise the amount typed. Undefined when that isn't valid.
 */
export function buyDisplayQty(item: Item | undefined, value: BuyAmount): string | null | undefined {
  const stored = item?.list === 'buy' ? item.displayQty : undefined;
  if (stored !== undefined) {
    const was = parseBuyAmount(stored);
    if (was.amount === value.amount && was.unit === value.unit) return stored;
  }
  return buyAmountText(value);
}

/**
 * Whether the form keeps counting the item the bring list's way (one / quantity / per person)
 * instead of by amount: a quantity or per-person item someone already took. Its kind can't change
 * (the API refuses), and an amount next to a count that stays would say something else (`2/4` on
 * its row, `8 יח׳` in the store).
 */
export const countedByKind = (item: Item | undefined, claimed: boolean) =>
  !!item && item.kind !== 'single' && claimed;

/**
 * What the form saves about how much, over the rest of the item. By amount: one item for the
 * group, with its amount as text. Counted by kind (the bring list, or `countedByKind`): the kind
 * and count picked, with the amount text left as it is (a bring item's from a bulk add or a copy
 * too). Moved off the buy list, it has none.
 */
export function amountFields(
  item: Item | undefined,
  list: ListKind,
  byAmount: boolean,
  displayQty: string | null,
): Pick<NewItemInput, 'displayQty'> & Partial<Pick<NewItemInput, 'kind' | 'quantityNeeded'>> {
  if (list === 'buy' && byAmount) return { kind: 'single', quantityNeeded: 1, displayQty };
  if (item?.list === 'buy' && list === 'bring') return { displayQty: null };
  return {};
}

/** Why the amount can't be saved, if it can't. */
export function buyAmountError(value: BuyAmount): string | undefined {
  if (buyAmountText(value) !== undefined) return undefined;
  const typed = value.amount.trim();
  if (!typed) return he.addItem.noAmount;
  if (!/^\d+([.,]\d+)?$/.test(typed)) return he.addItem.badAmount;
  if (Number(typed.replace(',', '.')) > BUY_AMOUNT_MAX) return he.addItem.maxAmount;
  if (/[.,]/.test(typed) && !allowsFraction(value.unit)) return he.addItem.wholeAmount;
  return he.addItem.badAmount;
}
