import {
  activeMemberIds,
  balances,
  claimsFor,
  isDone,
  itemStatus,
  splitEqually,
  suggestTransfers,
  type Item,
  type ListKind,
} from '@yallist/domain';

import type { AvatarPerson } from '@/components/Avatar';
import { he } from '@/i18n/he';
import type { TripData, TripMember } from '@/state/types';

export function initial(name: string): string {
  return name.trim().charAt(0) || '?';
}

export function toAvatar(member: TripMember, me: string): AvatarPerson {
  return { initial: initial(member.displayName), color: member.color, isMe: member.userId === me };
}

/** Everything the trip screens derive from raw trip data, computed once per render. */
export function deriveTrip(data: TripData, me: string) {
  const activeIds = activeMemberIds(data.members);
  const memberById = new Map(data.members.map((m) => [m.userId, m]));
  const displayNameOf = (id: string) => memberById.get(id)?.displayName ?? he.unknownPerson;
  /** "אני" for the current user (money rows, chips); use displayNameOf inside third-person phrases. */
  const nameOf = (id: string) => (id === me ? he.me : displayNameOf(id));
  const avatarOf = (id: string): AvatarPerson => {
    const m = memberById.get(id);
    return m ? toAvatar(m, me) : { initial: '?', color: '#E9ECF2' };
  };

  const items = [...data.items].sort((a, b) => a.position - b.position);
  const done = (i: Item) => isDone(i, data.claims, data.expenses, activeIds);
  const doneCount = items.filter(done).length;
  const missingIn = (list: ListKind) => items.filter((i) => i.list === list && !done(i)).length;
  const myQuantity = (itemId: string) =>
    claimsFor(itemId, data.claims).find((c) => c.userId === me)?.quantity ?? 0;
  const mine = items.filter((i) => myQuantity(i.id) > 0);

  const balance = balances(activeIds, data.expenses, data.payments);
  const transfers = suggestTransfers(balance);

  return {
    activeIds,
    memberById,
    nameOf,
    displayNameOf,
    avatarOf,
    items,
    done,
    doneCount,
    missingCount: items.length - doneCount,
    missingIn,
    myQuantity,
    mine,
    status: (item: Item) => itemStatus(item, data.claims, data.expenses, activeIds, me),
    balance,
    transfers,
    totalSpent: data.expenses.reduce((sum, e) => sum + e.amountAgorot, 0),
    myShare: data.expenses.reduce(
      (sum, e) => sum + (splitEqually(e.amountAgorot, e.shares).get(me) ?? 0),
      0,
    ),
  };
}

export type TripView = ReturnType<typeof deriveTrip>;
