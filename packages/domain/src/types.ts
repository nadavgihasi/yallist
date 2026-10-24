export type ListKind = 'bring' | 'buy';
export type ItemKind = 'single' | 'qty' | 'each';
export type TemplateId = 'camp' | 'grill' | 'zimmer' | 'beach' | 'blank';
export type MemberRole = 'organizer' | 'member';
export type MemberStatus = 'pending' | 'active' | 'removed';

export interface Member {
  userId: string;
  displayName: string;
  role: MemberRole;
  status: MemberStatus;
}

export interface Item {
  id: string;
  list: ListKind;
  category: string;
  position: number;
  name: string;
  kind: ItemKind;
  /** 1 for single, ≥2 for qty, ignored for each. */
  quantityNeeded: number;
  unit?: string;
  /** Free text for buy items, e.g. "4 ק״ג". */
  displayQty?: string;
  note?: string;
}

export interface Claim {
  itemId: string;
  userId: string;
  quantity: number;
  arrived?: boolean;
}

export interface Expense {
  id: string;
  itemId?: string;
  description: string;
  amountAgorot: number;
  paidBy: string;
  /** Participants the expense is split between. */
  shares: string[];
}

export interface Payment {
  id: string;
  fromUser: string;
  toUser: string;
  amountAgorot: number;
  status: 'marked' | 'confirmed';
}
