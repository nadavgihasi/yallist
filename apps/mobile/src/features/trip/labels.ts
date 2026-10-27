import {
  claimedQuantity,
  formatShekel,
  type Claim,
  type Item,
  type ItemStatus,
} from '@yallist/domain';

import { groupMissing, he, missingCount } from '@/i18n/he';
import { colors } from '@/theme';

import type { TripView } from './derive';

export type Tone = 'missing' | 'mine' | 'ok' | 'success';

/** Only "yours" stands out (HANDOFF.md item states); the ring and the action carry the rest. */
export const TONE_COLOR: Record<Tone, string> = {
  missing: colors.inkMuted,
  mine: colors.brandStrong,
  ok: colors.inkMuted,
  success: colors.inkMuted,
};

/** Hebrew status line for an item row (SPEC §4 table). Never puts "אני" after "אצל". */
export function statusLine(
  item: Item,
  status: ItemStatus,
  claims: readonly Claim[],
  view: TripView,
  me: string,
): { label: string; detail?: string; tone: Tone } {
  const s = he.status;
  // My share first (TripV2: `names.unshift('אצלך ' + my)`), then everyone else.
  const qtyHolders = () =>
    claims
      .filter((c) => c.itemId === item.id)
      .sort((a, b) => Number(b.userId === me) - Number(a.userId === me))
      .map((c) =>
        c.userId === me ? s.mineQty(c.quantity) : `${view.nameOf(c.userId)} ${c.quantity}`,
      )
      .join(', ');
  const holders = (ids: string[]) =>
    item.kind === 'qty' ? qtyHolders() : s.at(ids.map(view.nameOf).join(', '));

  // In someone else's shopping run: they're at the store with it now.
  const shopper = status.kind === 'bought' ? undefined : view.shopperOf(item.id);
  if (shopper && shopper !== me) {
    return { label: he.shop.buying(view.displayNameOf(shopper)), tone: 'ok' };
  }

  switch (status.kind) {
    case 'missing':
      return { label: s.missing, tone: 'missing' };
    case 'partial':
      return { label: missingCount(status.missing), detail: qtyHolders(), tone: 'missing' };
    case 'each':
      return {
        label: s.of(status.have, status.total),
        // Your own name rather than "אני": "עוד לא: אני" reads wrong.
        detail: s.notYet(status.missingIds.map(view.displayNameOf).join(', ')),
        tone: 'missing',
      };
    case 'mine':
      return { label: s.mine, tone: 'mine' };
    case 'covered':
      if (item.kind === 'each') {
        const n = view.activeIds.length;
        return { label: s.of(n, n), tone: 'ok' };
      }
      return { label: s.covered, detail: holders(status.holderIds), tone: 'ok' };
    case 'inProgress':
      return { label: s.inProgress, detail: holders(status.holderIds), tone: 'ok' };
    case 'bought': {
      const amount = formatShekel(status.expense.amountAgorot);
      return {
        label: s.bought,
        detail:
          status.expense.paidBy === me
            ? s.boughtByMe(amount)
            : s.boughtBy(amount, view.nameOf(status.expense.paidBy)),
        tone: 'success',
      };
    }
  }
}

/** The quantity text next to the item name (`5/8`, `לכל אחד`, `4 ק״ג`). */
export function quantityText(item: Item, claims: readonly Claim[]): string {
  if (item.kind === 'each') return he.status.forEach;
  if (item.kind === 'qty') {
    const total = claimedQuantity(item.id, claims);
    return `${total}/${item.quantityNeeded}${item.unit ? ` ${item.unit}` : ''}`;
  }
  return item.displayQty ?? '';
}

/** A buy item's amount in the shopping screens: its free text, or `×40` for a quantity. */
export function buyQuantity(item: Item): string {
  return item.displayQty ?? (item.kind === 'qty' ? `×${item.quantityNeeded}` : '');
}

export function groupSummary(missing: number): string {
  return missing === 0 ? he.trip.allCovered : groupMissing(missing);
}
