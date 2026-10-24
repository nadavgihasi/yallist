import {
  TEMPLATES,
  claimCap,
  type Expense,
  type Item,
  type ItemKind,
  type ListKind,
  type TemplateId,
} from '@yallist/domain';

import { newId } from '@/lib/id';
import { avatarPalette } from '@/theme';

import type { AppState, Me, TripData, TripMember } from './types';

export type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'signIn'; me: Me }
  | { type: 'createTrip'; trip: TripData }
  | { type: 'deleteTrip'; tripId: string }
  | { type: 'addMember'; tripId: string; userId: string; name: string }
  | { type: 'setClaim'; tripId: string; itemId: string; userId: string; quantity: number }
  | { type: 'addItem'; tripId: string; item: Item }
  | { type: 'deleteItem'; tripId: string; itemId: string }
  | { type: 'setNote'; tripId: string; itemId: string; note: string }
  | { type: 'saveExpense'; tripId: string; expense: Expense }
  | { type: 'deleteExpense'; tripId: string; expenseId: string }
  | { type: 'markPayment'; tripId: string; id: string; from: string; to: string; amount: number }
  | { type: 'deletePayment'; tripId: string; paymentId: string };

export function memberColor(index: number): string {
  return avatarPalette[index % avatarPalette.length]!;
}

export interface NewTripInput {
  name: string;
  startsOn: string;
  endsOn: string;
  placeText?: string;
  template: TemplateId;
}

/** A new trip with the creator as organizer and items seeded from the template. */
export function buildTrip(input: NewTripInput, me: Me): TripData {
  const positions: Record<ListKind, number> = { bring: 0, buy: 0 };
  const items: Item[] = TEMPLATES[input.template].map((t) => ({
    id: newId(),
    position: positions[t.list]++,
    ...t,
  }));
  const organizer: TripMember = {
    userId: me.userId,
    displayName: me.name,
    role: 'organizer',
    status: 'active',
    color: memberColor(0),
  };
  return {
    trip: { id: newId(), createdAt: new Date().toISOString(), ...input },
    members: [organizer],
    items,
    claims: [],
    expenses: [],
    payments: [],
  };
}

export interface NewItemInput {
  list: ListKind;
  name: string;
  kind: ItemKind;
  quantityNeeded: number;
  category: string;
}

export function buildItem(input: NewItemInput, existing: Item[]): Item {
  const position = existing.filter((i) => i.list === input.list).length;
  return { id: newId(), position, ...input };
}

function updateTrip(state: AppState, tripId: string, fn: (t: TripData) => TripData): AppState {
  const trip = state.trips[tripId];
  if (!trip) return state;
  return { ...state, trips: { ...state.trips, [tripId]: fn(trip) } };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'signIn':
      return { ...state, me: action.me };
    case 'createTrip':
      return { ...state, trips: { ...state.trips, [action.trip.trip.id]: action.trip } };
    case 'deleteTrip': {
      const { [action.tripId]: _removed, ...trips } = state.trips;
      return { ...state, trips };
    }
    case 'addMember':
      return updateTrip(state, action.tripId, (t) => ({
        ...t,
        members: [
          ...t.members,
          {
            userId: action.userId,
            displayName: action.name,
            role: 'member',
            status: 'active',
            color: memberColor(t.members.length),
          },
        ],
      }));
    case 'setClaim':
      return updateTrip(state, action.tripId, (t) => {
        const item = t.items.find((i) => i.id === action.itemId);
        if (!item) return t;
        // Same cap the server will enforce: never claim past what's still needed.
        const quantity = Math.min(action.quantity, claimCap(item, t.claims, action.userId));
        const others = t.claims.filter(
          (c) => !(c.itemId === action.itemId && c.userId === action.userId),
        );
        return {
          ...t,
          claims:
            quantity > 0
              ? [...others, { itemId: action.itemId, userId: action.userId, quantity }]
              : others,
        };
      });
    case 'addItem':
      return updateTrip(state, action.tripId, (t) => ({ ...t, items: [...t.items, action.item] }));
    case 'deleteItem':
      return updateTrip(state, action.tripId, (t) => ({
        ...t,
        items: t.items.filter((i) => i.id !== action.itemId),
        claims: t.claims.filter((c) => c.itemId !== action.itemId),
        expenses: t.expenses.map((e) =>
          e.itemId === action.itemId ? { ...e, itemId: undefined } : e,
        ),
      }));
    case 'setNote':
      return updateTrip(state, action.tripId, (t) => ({
        ...t,
        items: t.items.map((i) =>
          i.id === action.itemId ? { ...i, note: action.note || undefined } : i,
        ),
      }));
    case 'saveExpense':
      return updateTrip(state, action.tripId, (t) => ({
        ...t,
        expenses: t.expenses.some((e) => e.id === action.expense.id)
          ? t.expenses.map((e) => (e.id === action.expense.id ? action.expense : e))
          : [...t.expenses, action.expense],
      }));
    case 'deleteExpense':
      return updateTrip(state, action.tripId, (t) => ({
        ...t,
        expenses: t.expenses.filter((e) => e.id !== action.expenseId),
      }));
    case 'markPayment':
      return updateTrip(state, action.tripId, (t) => ({
        ...t,
        payments: [
          ...t.payments,
          {
            id: action.id,
            fromUser: action.from,
            toUser: action.to,
            amountAgorot: action.amount,
            status: 'marked',
          },
        ],
      }));
    case 'deletePayment':
      return updateTrip(state, action.tripId, (t) => ({
        ...t,
        payments: t.payments.filter((p) => p.id !== action.paymentId),
      }));
  }
}
