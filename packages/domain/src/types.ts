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

/** A named group of items within one list of a trip. */
export interface Category {
  id: string;
  list: ListKind;
  name: string;
  position: number;
}

export interface Item {
  id: string;
  list: ListKind;
  /** Absent: uncategorized. */
  categoryId?: string;
  position: number;
  name: string;
  kind: ItemKind;
  /** 1 for single, ≥2 for qty, ignored for each. */
  quantityNeeded: number;
  unit?: string;
  /** Free text for buy items, e.g. "4 ק״ג". */
  displayQty?: string;
  note?: string;
  /** Who added it and when (ISO); the store screen shows items added during a run. */
  createdBy?: string;
  createdAt?: string;
}

export interface Claim {
  itemId: string;
  userId: string;
  quantity: number;
  arrived?: boolean;
  /** The shopping run that claimed it. */
  runId?: string;
  /** Checked off in the store, while its run is active. */
  inCart?: boolean;
}

export interface Expense {
  id: string;
  /** The buy items this purchase covers: they count as bought. */
  itemIds?: string[];
  description: string;
  amountAgorot: number;
  paidBy: string;
  /** Participants the expense is split between. */
  shares: string[];
  /** A receipt photo is attached (fetched separately, as a short-lived link). */
  hasReceipt?: boolean;
}

export interface Payment {
  id: string;
  fromUser: string;
  toUser: string;
  amountAgorot: number;
  status: 'marked' | 'confirmed';
}
