import type { Claim, Item } from '@yallist/domain';
import { describe, expect, it } from 'vitest';

import { assignTap, canAssign, othersRun } from './assign';

const tent: Item = {
  id: 'tent',
  list: 'bring',
  position: 0,
  name: 'אוהל',
  kind: 'single',
  quantityNeeded: 1,
};
const chairs: Item = { ...tent, id: 'chairs', name: 'כיסאות', kind: 'qty', quantityNeeded: 4 };
const towel: Item = { ...tent, id: 'towel', name: 'מגבת', kind: 'each' };
const has = (itemId: string, userId: string, quantity = 1, runId?: string): Claim => ({
  itemId,
  userId,
  quantity,
  ...(runId && { runId }),
});

describe('the "who brings it" picker', () => {
  it('assigns a free single item to whoever is tapped; to me, as my own claim', () => {
    expect(assignTap(tent, [], 'dana', 'me')).toEqual({ userId: 'dana', quantity: 1 });
    expect(assignTap(tent, [], 'me', 'me')).toEqual({ quantity: 1 });
  });

  it('moves a single item from its holder, and takes it off them when they are tapped', () => {
    const claims = [has('tent', 'dana')];
    expect(assignTap(tent, claims, 'ron', 'me')).toEqual({
      userId: 'ron',
      quantity: 1,
      from: 'dana',
    });
    expect(assignTap(tent, claims, 'me', 'me')).toEqual({ quantity: 1, from: 'dana' });
    expect(assignTap(tent, claims, 'dana', 'me')).toEqual({ userId: 'dana', quantity: 0 });
  });

  it("gives a qty item's missing part, and nothing once it's all taken", () => {
    const claims = [has('chairs', 'dana', 3)];
    expect(assignTap(chairs, claims, 'ron', 'me')).toEqual({ userId: 'ron', quantity: 1 });
    const full = [...claims, has('chairs', 'ron', 1)];
    expect(assignTap(chairs, full, 'me', 'me')).toBeUndefined();
    expect(assignTap(chairs, full, 'ron', 'me')).toEqual({ userId: 'ron', quantity: 0 });
  });

  it("leaves per-person items and others' shopping runs alone", () => {
    expect(canAssign(towel)).toBe(false);
    expect(assignTap(towel, [], 'dana', 'me')).toBeUndefined();
    const inRun = [has('tent', 'dana', 1, 'run')];
    expect(assignTap(tent, inRun, 'ron', 'me')).toBeUndefined();
    expect(assignTap(tent, inRun, 'dana', 'me')).toBeUndefined();
    // ...and the picker says whose run it's in.
    expect(othersRun(tent, inRun, 'me')).toBe('dana');
    expect(othersRun(tent, [has('tent', 'me', 1, 'run')], 'me')).toBeUndefined();
    expect(othersRun(tent, [has('tent', 'dana')], 'me')).toBeUndefined();
    // My own run's claim is mine to hand over.
    expect(assignTap(tent, [has('tent', 'me', 1, 'run')], 'ron', 'me')).toEqual({
      userId: 'ron',
      quantity: 1,
      from: 'me',
    });
  });
});
