import type { Claim, Expense, Item, Member, Payment, TemplateId } from '@yallist/domain';

export interface Me {
  userId: string;
  name: string;
}

export interface Trip {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  placeText?: string;
  template: TemplateId;
  createdAt: string;
}

export interface TripMember extends Member {
  /** Avatar background from the palette; the current user is drawn in the accent color instead. */
  color: string;
}

export interface TripData {
  trip: Trip;
  members: TripMember[];
  items: Item[];
  claims: Claim[];
  expenses: Expense[];
  payments: Payment[];
}

export interface AppState {
  me?: Me;
  trips: Record<string, TripData>;
}
