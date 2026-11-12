/**
 * Where the trip screen's tabs pin (phone and tablet): once they scroll up to the pinned bar, the
 * bar's copy takes over. Plain numbers, so it's testable without React Native.
 */

/** The scroll offset where the tabs, `tabsY` down the page, meet the pinned bar's tabs. */
export const pinOffset = (tabsY: number, insetTop: number, barAboveTabs: number) =>
  Math.max(0, tabsY - insetTop - barAboveTabs);

/**
 * The least height for the tabs and their content, so the page can always scroll up to
 * `pinOffset`: switching to a short tab while pinned then stays pinned, without a jump. Under
 * the tabs come `gapBelow`, then the add button's `clearance` and the bottom inset.
 */
export const tabsMinHeight = (p: {
  viewport: number;
  insetTop: number;
  insetBottom: number;
  barAboveTabs: number;
  gapBelow: number;
  clearance: number;
}) =>
  Math.max(0, p.viewport - p.insetTop - p.barAboveTabs - p.gapBelow - p.clearance - p.insetBottom);
