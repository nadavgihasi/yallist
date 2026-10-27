import type { Item } from '@yallist/domain';
import { describe, expect, it } from 'vitest';

import { applyAction } from './reducer';
import type { TripData, TripMember } from './types';

const member = (userId: string, role: TripMember['role'] = 'member'): TripMember => ({
  userId,
  displayName: userId,
  role,
  status: 'active',
  color: '#FFD9C2',
});

const chairs: Item = {
  id: 'chairs',
  list: 'bring',
  categoryId: 'sitting',
  position: 0,
  name: 'כיסאות מתקפלים',
  kind: 'qty',
  quantityNeeded: 8,
};
const meat: Item = {
  ...chairs,
  id: 'meat',
  list: 'buy',
  name: 'בשר',
  kind: 'single',
  quantityNeeded: 1,
};

function trip(overrides: Partial<TripData> = {}): TripData {
  return {
    trip: {
      id: 't1',
      name: 'קמפינג',
      startsOn: '2026-11-13',
      endsOn: '2026-11-14',
      placeText: undefined,
      template: 'camp',
      cover: 'camp',
      status: 'planning',
      requireApproval: false,
      createdAt: '2026-10-24T00:00:00.000Z',
    },
    inviteToken: 'token',
    members: [member('me', 'organizer'), member('ron')],
    categories: [],
    items: [chairs, meat],
    claims: [],
    expenses: [],
    payments: [],
    runs: [],
    balances: {},
    transfers: [],
    ...overrides,
  };
}

describe('setClaim', () => {
  it('caps a claim at what is still needed, as the API will', () => {
    const t = trip({ claims: [{ itemId: 'chairs', userId: 'ron', quantity: 6 }] });
    const next = applyAction(t, { type: 'setClaim', itemId: 'chairs', quantity: 5 }, 'me');
    expect(next.claims.find((c) => c.userId === 'me')?.quantity).toBe(2);
  });

  it('removes the claim at zero', () => {
    const t = trip({ claims: [{ itemId: 'meat', userId: 'me', quantity: 1 }] });
    expect(applyAction(t, { type: 'setClaim', itemId: 'meat', quantity: 0 }, 'me').claims).toEqual(
      [],
    );
  });
});

describe('deleteItem', () => {
  it('drops claims but keeps the expense, unlinked, so balances do not change', () => {
    const t = trip({
      claims: [{ itemId: 'meat', userId: 'me', quantity: 1 }],
      expenses: [
        {
          id: 'e1',
          itemIds: ['meat'],
          description: 'בשר',
          amountAgorot: 45000,
          paidBy: 'me',
          shares: ['me'],
        },
      ],
    });
    const next = applyAction(t, { type: 'deleteItem', itemId: 'meat' }, 'me');
    expect(next.items.map((i) => i.id)).toEqual(['chairs']);
    expect(next.claims).toEqual([]);
    expect(next.expenses).toEqual([expect.objectContaining({ id: 'e1', itemIds: [] })]);
  });
});

describe('editItem', () => {
  it('shows the edited fields at once', () => {
    const changes = {
      list: 'bring',
      name: 'צידנית',
      kind: 'qty',
      quantityNeeded: 2,
      categoryId: 'food',
    } as const;
    const next = applyAction(trip(), { type: 'editItem', itemId: 'meat', changes }, 'me');
    expect(next.items).toEqual([chairs, { ...meat, ...changes }]);
  });

  it('moves the item out of its category, or waits for a new one', () => {
    const changes = { ...chairs, categoryId: null };
    const out = applyAction(trip(), { type: 'editItem', itemId: 'chairs', changes }, 'me');
    expect(out.items[0]).toEqual({ ...chairs, categoryId: undefined });
    const action = { type: 'editItem', itemId: 'chairs', changes, newCategory: 'חדש' } as const;
    expect(applyAction(trip(), action, 'me').items[0]).toEqual(chairs);
  });
});

describe('categories', () => {
  const t = () =>
    trip({
      categories: [
        { id: 'sitting', list: 'bring', name: 'ישיבה', position: 0 },
        { id: 'sleeping', list: 'bring', name: 'לינה', position: 1 },
      ],
    });

  it('renames and reorders at once', () => {
    const renamed = applyAction(
      t(),
      { type: 'renameCategory', categoryId: 'sitting', name: 'כיסאות' },
      'me',
    );
    expect(renamed.categories[0]).toMatchObject({ id: 'sitting', name: 'כיסאות' });
    const order = ['sleeping', 'sitting'];
    const action = { type: 'reorderCategories', list: 'bring', categoryIds: order } as const;
    expect(applyAction(t(), action, 'me').categories.map((c) => [c.id, c.position])).toEqual([
      ['sitting', 1],
      ['sleeping', 0],
    ]);
  });

  it('deletes a category and keeps its items, uncategorized', () => {
    const next = applyAction(t(), { type: 'deleteCategory', categoryId: 'sitting' }, 'me');
    expect(next.categories.map((c) => c.id)).toEqual(['sleeping']);
    expect(next.items[0]).toEqual({ ...chairs, categoryId: undefined });
  });
});

describe('members', () => {
  it('approves a pending member', () => {
    const t = trip({
      members: [member('me', 'organizer'), { ...member('dana'), status: 'pending' }],
    });
    const next = applyAction(t, { type: 'approveMember', userId: 'dana' }, 'me');
    expect(next.members[1]?.status).toBe('active');
  });

  it('removes a member and frees what they took', () => {
    const t = trip({ claims: [{ itemId: 'meat', userId: 'ron', quantity: 1 }] });
    const next = applyAction(t, { type: 'removeMember', userId: 'ron' }, 'me');
    expect(next.members[1]?.status).toBe('removed');
    expect(next.claims).toEqual([]);
  });
});

describe('payments', () => {
  it('confirms a payment at once', () => {
    const payment = {
      id: 'p1',
      fromUser: 'ron',
      toUser: 'me',
      amountAgorot: 9000,
      status: 'marked',
    } as const;
    const next = applyAction(
      trip({ payments: [payment] }),
      { type: 'confirmPayment', paymentId: 'p1' },
      'me',
    );
    expect(next.payments).toEqual([{ ...payment, status: 'confirmed' }]);
  });
});

describe('trip', () => {
  it('changes the cover at once', () => {
    expect(applyAction(trip(), { type: 'setCover', cover: 'winter' }, 'me').trip.cover).toBe(
      'winter',
    );
  });
});

describe('changes that need a server id', () => {
  it('wait for the API', () => {
    const t = trip();
    const action = {
      type: 'addItem',
      item: { list: 'buy', name: 'אבטיח', kind: 'single', quantityNeeded: 1, categoryId: null },
      claim: 1,
    } as const;
    expect(applyAction(t, action, 'me')).toBe(t);
  });
});

describe('shopping runs', () => {
  const water: Item = { ...meat, id: 'water', name: 'מים', position: 1 };
  const run = { id: 'r1', shopperId: 'me', startedAt: '2026-11-12T08:00:00.000Z' };
  const inRun = (itemId: string, inCart?: boolean) => ({
    itemId,
    userId: 'me',
    quantity: 1,
    runId: 'r1',
    inCart,
  });

  it('adds an unclaimed item to the run, never one someone has', () => {
    const t = trip({ items: [chairs, meat, water], runs: [run] });
    const next = applyAction(t, { type: 'addToRun', runId: 'r1', itemId: 'water' }, 'me');
    expect(next.claims).toEqual([{ itemId: 'water', userId: 'me', quantity: 1, runId: 'r1' }]);
    const taken = trip({ claims: [{ itemId: 'meat', userId: 'ron', quantity: 1 }], runs: [run] });
    expect(applyAction(taken, { type: 'addToRun', runId: 'r1', itemId: 'meat' }, 'me')).toBe(taken);
  });

  it('checks my run items in and out of the cart', () => {
    const t = trip({ claims: [inRun('meat')], runs: [run] });
    const inCart = applyAction(t, { type: 'setInCart', itemId: 'meat', inCart: true }, 'me');
    expect(inCart.claims).toEqual([inRun('meat', true)]);
    const out = applyAction(inCart, { type: 'setInCart', itemId: 'meat', inCart: false }, 'me');
    expect(out.claims).toEqual([inRun('meat', undefined)]);
  });

  it('returns what is not in the cart on finish, and everything on cancel', () => {
    const t = trip({
      items: [chairs, meat, water],
      claims: [
        inRun('meat', true),
        inRun('water'),
        { itemId: 'chairs', userId: 'ron', quantity: 2 },
      ],
      runs: [run],
    });
    const finished = applyAction(
      t,
      { type: 'finishRun', runId: 'r1', amountAgorot: 100, shares: ['me'] },
      'me',
    );
    expect(finished.claims.map((c) => c.itemId)).toEqual(['meat', 'chairs']);
    expect(finished.runs).toEqual([run]);

    const cancelled = applyAction(t, { type: 'cancelRun', runId: 'r1' }, 'me');
    expect(cancelled.claims.map((c) => c.itemId)).toEqual(['chairs']);
    expect(cancelled.runs).toEqual([]);
  });
});
