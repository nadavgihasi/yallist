import { describe, expect, it } from 'vitest';

import { crop } from './coverCrop';

/** The camp scene's focal point: its tent stands from y 214 to 264, the sun sets at 70–166. */
const camp = { x: 84, y: 222 };
const band = (viewBox: string) => {
  const [, y, , h] = viewBox.split(' ').map(Number) as [number, number, number, number];
  return { top: y, bottom: y + h };
};

describe('crop', () => {
  it('keeps the horizon above the tent in the trip header, not just the ground', () => {
    // The trip header at phone width: 358×120.
    const { top, bottom } = band(crop(camp, 358, 120));
    expect(top).toBeLessThan(140);
    expect(bottom).toBeGreaterThanOrEqual(264);
  });

  it('stays inside the scene', () => {
    expect(band(crop({ x: 84, y: 290 }, 358, 120)).bottom).toBe(300);
    expect(band(crop({ x: 84, y: 10 }, 358, 120)).top).toBe(0);
  });

  it('centers a narrow box on the focal point across', () => {
    expect(crop(camp, 150, 150)).toBe('0 0 300 300');
    expect(crop({ x: 200, y: 150 }, 150, 150)).toBe('50 0 300 300');
  });
});
