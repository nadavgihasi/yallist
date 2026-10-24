import { describe, expect, it } from 'vitest';

import { buildItem, buildTrip, reducer } from './reducer';
import type { AppState, TripData } from './types';

const me = { userId: 'me', name: 'נדב' };

function stateWith(trip: TripData): AppState {
  return { me, trips: { [trip.trip.id]: trip } };
}

function campTrip() {
  return buildTrip(
    { name: 'קמפינג', startsOn: '2026-11-13', endsOn: '2026-11-14', template: 'camp' },
    me,
  );
}

describe('buildTrip', () => {
  it('makes the creator an active organizer and seeds positions per list', () => {
    const t = campTrip();
    expect(t.members).toMatchObject([{ userId: 'me', role: 'organizer', status: 'active' }]);
    for (const list of ['bring', 'buy'] as const) {
      const positions = t.items.filter((i) => i.list === list).map((i) => i.position);
      expect(positions).toEqual(positions.map((_, i) => i));
    }
  });
});

describe('setClaim', () => {
  it('caps a claim at what is still needed', () => {
    const t = campTrip();
    const chairs = t.items.find((i) => i.name === 'כיסאות מתקפלים')!;
    let s = stateWith(t);
    s = reducer(s, {
      type: 'setClaim',
      tripId: t.trip.id,
      itemId: chairs.id,
      userId: 'ron',
      quantity: 6,
    });
    s = reducer(s, {
      type: 'setClaim',
      tripId: t.trip.id,
      itemId: chairs.id,
      userId: 'me',
      quantity: 5,
    });
    const mine = s.trips[t.trip.id]!.claims.find((c) => c.userId === 'me');
    expect(mine?.quantity).toBe(2);
  });

  it('removes the claim at zero', () => {
    const t = campTrip();
    const grill = t.items.find((i) => i.name === 'מנגל')!;
    let s = stateWith(t);
    s = reducer(s, {
      type: 'setClaim',
      tripId: t.trip.id,
      itemId: grill.id,
      userId: 'me',
      quantity: 1,
    });
    s = reducer(s, {
      type: 'setClaim',
      tripId: t.trip.id,
      itemId: grill.id,
      userId: 'me',
      quantity: 0,
    });
    expect(s.trips[t.trip.id]!.claims).toEqual([]);
  });
});

describe('addItem + claim', () => {
  it('can be claimed right after being added', () => {
    const t = campTrip();
    const item = buildItem(
      { list: 'buy', name: 'אבטיח', kind: 'single', quantityNeeded: 1, category: 'כללי' },
      t.items,
    );
    let s = reducer(stateWith(t), { type: 'addItem', tripId: t.trip.id, item });
    s = reducer(s, {
      type: 'setClaim',
      tripId: t.trip.id,
      itemId: item.id,
      userId: 'me',
      quantity: 1,
    });
    const trip = s.trips[t.trip.id]!;
    expect(item.position).toBe(t.items.filter((i) => i.list === 'buy').length);
    expect(trip.claims).toEqual([{ itemId: item.id, userId: 'me', quantity: 1 }]);
  });
});

describe('deleteItem', () => {
  it('drops claims but keeps the expense, unlinked, so balances do not change', () => {
    const t = campTrip();
    const meat = t.items.find((i) => i.name === 'בשר לעל האש')!;
    let s = stateWith(t);
    s = reducer(s, {
      type: 'setClaim',
      tripId: t.trip.id,
      itemId: meat.id,
      userId: 'me',
      quantity: 1,
    });
    s = reducer(s, {
      type: 'saveExpense',
      tripId: t.trip.id,
      expense: {
        id: 'e1',
        itemId: meat.id,
        description: 'בשר',
        amountAgorot: 45000,
        paidBy: 'me',
        shares: ['me'],
      },
    });
    s = reducer(s, { type: 'deleteItem', tripId: t.trip.id, itemId: meat.id });
    const trip = s.trips[t.trip.id]!;
    expect(trip.items.some((i) => i.id === meat.id)).toBe(false);
    expect(trip.claims).toEqual([]);
    expect(trip.expenses).toEqual([expect.objectContaining({ id: 'e1', itemId: undefined })]);
  });
});
