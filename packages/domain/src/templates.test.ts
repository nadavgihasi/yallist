import { describe, expect, it } from 'vitest';

import { TEMPLATES } from './templates';

const all = Object.entries(TEMPLATES).flatMap(([template, items]) =>
  items.map((item) => ({ template, ...item })),
);

// New trips copy these items as they are, so they must pass the same checks as an item a
// member adds (apps/api/src/routes/items.ts, categories.ts).
describe('TEMPLATES', () => {
  it('gives every item a valid quantity for its kind', () => {
    for (const item of all) {
      const label = `${item.template}: ${item.name}`;
      if (item.kind === 'qty') expect(item.quantityNeeded, label).toBeGreaterThanOrEqual(2);
      else expect(item.quantityNeeded, label).toBe(1);
    }
  });

  it('keeps every item within the item and category limits', () => {
    for (const item of all) {
      const label = `${item.template}: ${item.name}`;
      expect(item.name.length, label).toBeGreaterThan(0);
      expect(item.name.length, label).toBeLessThanOrEqual(80);
      expect(item.unit?.length ?? 0, label).toBeLessThanOrEqual(20);
      expect(item.displayQty?.length ?? 0, label).toBeLessThanOrEqual(20);
      expect(item.category.length, label).toBeGreaterThan(0);
      expect(item.category.length, label).toBeLessThanOrEqual(40);
    }
  });

  it('keeps each list of a template free of duplicate names', () => {
    for (const items of Object.values(TEMPLATES)) {
      for (const list of ['bring', 'buy'] as const) {
        const names = items.filter((i) => i.list === list).map((i) => i.name);
        expect(new Set(names).size).toBe(names.length);
      }
    }
  });

  it('infers the kind: a quantity makes it qty, else single, unless set', () => {
    expect(TEMPLATES.camp.find((i) => i.name === 'פחמים')).toMatchObject({
      kind: 'qty',
      quantityNeeded: 2,
      unit: 'שקים',
    });
    expect(TEMPLATES.camp.find((i) => i.name === 'מנגל')).toMatchObject({
      kind: 'single',
      quantityNeeded: 1,
    });
    expect(TEMPLATES.camp.find((i) => i.name === 'שק שינה')).toMatchObject({
      kind: 'each',
      quantityNeeded: 1,
    });
  });

  it('starts the blank template empty', () => {
    expect(TEMPLATES.blank).toEqual([]);
  });
});
