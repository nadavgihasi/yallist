import {
  claimedQuantity,
  formatShekel,
  type Claim,
  type Item,
  type ItemStatus,
} from '@yallist/domain';

import { missingCount } from '@/i18n/he';
import { colors } from '@/theme';

import type { TripView } from './derive';

export type Tone = 'missing' | 'mine' | 'ok' | 'success';

export const TONE_COLOR: Record<Tone, string> = {
  missing: colors.missing,
  mine: colors.accent,
  ok: colors.inkSecondary,
  success: colors.success,
};

/** Hebrew status line for an item row (SPEC §4 table). */
export function statusLine(
  item: Item,
  status: ItemStatus,
  claims: readonly Claim[],
  view: TripView,
  me: string,
): { label: string; detail?: string; tone: Tone } {
  const holders = (ids: string[]) => ids.map(view.nameOf);
  const qtyHolders = () =>
    claims
      .filter((c) => c.itemId === item.id)
      .map((c) =>
        c.userId === me ? `אצלך ${c.quantity}` : `${view.nameOf(c.userId)} ${c.quantity}`,
      )
      .join(', ');

  switch (status.kind) {
    case 'missing':
      return { label: 'חסר', tone: 'missing' };
    case 'partial':
      return { label: missingCount(status.missing), detail: qtyHolders(), tone: 'missing' };
    case 'each':
      return {
        label: `${status.have} מתוך ${status.total}`,
        detail: `עוד לא: ${status.missingIds.map(view.nameOf).join(', ')}`,
        tone: 'missing',
      };
    case 'mine':
      return { label: 'אצלך', tone: 'mine' };
    case 'covered':
      if (item.kind === 'each') {
        return { label: `${view.activeIds.length} מתוך ${view.activeIds.length}`, tone: 'ok' };
      }
      return {
        label: 'מכוסה',
        detail: item.kind === 'qty' ? qtyHolders() : `אצל ${holders(status.holderIds).join(', ')}`,
        tone: 'ok',
      };
    case 'inProgress':
      return { label: 'בטיפול', detail: `אצל ${holders(status.holderIds).join(', ')}`, tone: 'ok' };
    case 'bought':
      return {
        label: 'נקנה',
        detail: `${formatShekel(status.expense.amountAgorot)}, ${view.nameOf(status.expense.paidBy)}`,
        tone: 'success',
      };
  }
}

/** The quantity text next to the item name (`5/8`, `לכל אחד`, `4 ק״ג`). */
export function quantityText(item: Item, claims: readonly Claim[]): string {
  if (item.kind === 'each') return 'לכל אחד';
  if (item.kind === 'qty') {
    const total = claimedQuantity(item.id, claims);
    return `${total}/${item.quantityNeeded}${item.unit ? ` ${item.unit}` : ''}`;
  }
  return item.displayQty ?? '';
}

export function groupSummary(missing: number): { text: string; color: string } {
  if (missing === 0) return { text: 'הכול מכוסה', color: colors.success };
  return { text: missing === 1 ? 'חסר 1' : `${missing} חסרים`, color: colors.missing };
}
