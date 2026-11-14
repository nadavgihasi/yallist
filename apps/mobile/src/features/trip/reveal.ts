import type { ListKind } from '@yallist/domain';

/**
 * "Show me what I just added": a sheet asks for it as it saves, and the trip screen under it
 * switches to the right tab, scrolls the new row into view and flashes it once it's back on top.
 * Plain data and numbers, so it's testable without React Native.
 */
export type Reveal =
  /** Item names are unique on a list, and the name stays while the item's id goes from a
   *  placeholder to the server's. */
  | { kind: 'item'; list: ListKind; name: string }
  /** An expense shows once the API answers: the first one like it that wasn't there before. */
  | { kind: 'expense'; description: string; amountAgorot: number; before: readonly string[] };

/** The key a row registers under, so the trip screen can find it on the page. */
export const itemKey = (list: ListKind, name: string) => `item:${list}:${name}`;
export const expenseKey = (expenseId: string) => `expense:${expenseId}`;

interface Shown {
  items: readonly { id: string; list: ListKind; name: string }[];
  expenses: readonly { id: string; description: string; amountAgorot: number }[];
}

/** Where `reveal` is in the trip, once it's there: its tab and row key (and the item, if one). */
export function revealTarget(
  reveal: Reveal,
  data: Shown,
): { tab: ListKind | 'money'; key: string; itemId?: string } | undefined {
  if (reveal.kind === 'item') {
    const item = data.items.find((i) => i.list === reveal.list && i.name === reveal.name);
    return item && { tab: item.list, key: itemKey(item.list, item.name), itemId: item.id };
  }
  const before = new Set(reveal.before);
  const expense = data.expenses.find(
    (e) =>
      !before.has(e.id) &&
      e.description === reveal.description &&
      e.amountAgorot === reveal.amountAgorot,
  );
  return expense && { tab: 'money', key: expenseKey(expense.id) };
}

/** How long a request waits for its row: an expense offline may never come. */
const WAIT_MS = 15_000;

let pending: { tripId: string; reveal: Reveal; until: number } | undefined;

/** Asks the trip screen to show `reveal` once it's on the page. One at a time: the last wins. */
export const requestReveal = (tripId: string, reveal: Reveal, now = Date.now()) => {
  pending = { tripId, reveal, until: now + WAIT_MS };
};

/** The request waiting for this trip, if any and still fresh. */
export const pendingReveal = (tripId: string, now = Date.now()) =>
  pending && pending.tripId === tripId && now < pending.until ? pending.reveal : undefined;

export const clearReveal = () => {
  pending = undefined;
};

/**
 * The scroll offset that puts a row (`rowY` down the page, `rowHeight` tall) in the middle of
 * what's visible: the viewport less `coveredTop`, the pinned bar over its top. Never above the top.
 */
export const revealOffset = (p: {
  rowY: number;
  rowHeight: number;
  viewport: number;
  coveredTop: number;
}) => Math.max(0, Math.round(p.rowY + p.rowHeight / 2 - (p.viewport + p.coveredTop) / 2));
