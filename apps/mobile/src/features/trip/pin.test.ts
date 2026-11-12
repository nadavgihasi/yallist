import { describe, expect, it } from 'vitest';

import { pinOffset, tabsMinHeight } from './pin';

describe('pinOffset', () => {
  it('is where the tabs reach the pinned bar, never above the top', () => {
    expect(pinOffset(400, 0, 64)).toBe(336);
    expect(pinOffset(400, 24, 64)).toBe(312);
    expect(pinOffset(40, 24, 64)).toBe(0);
  });
});

describe('tabsMinHeight', () => {
  it('lets a short tab scroll up to the pinned bar', () => {
    const geometry = { insetTop: 24, insetBottom: 48, barAboveTabs: 64, gapBelow: 12 };
    const clearance = 120;
    for (const viewport of [667, 844]) {
      const tabsY = 380;
      const min = tabsMinHeight({ viewport, clearance, ...geometry });
      // The page: everything above the tabs, the tabs at their least height, then what's under.
      const content = tabsY + min + geometry.gapBelow + clearance + geometry.insetBottom;
      expect(content - viewport).toBe(pinOffset(tabsY, geometry.insetTop, geometry.barAboveTabs));
    }
  });

  it('is never negative', () => {
    expect(
      tabsMinHeight({
        viewport: 100,
        insetTop: 0,
        insetBottom: 0,
        barAboveTabs: 64,
        gapBelow: 12,
        clearance: 120,
      }),
    ).toBe(0);
  });
});
