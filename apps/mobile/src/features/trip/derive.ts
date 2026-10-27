import {
  activeMemberIds,
  claimsFor,
  isDone,
  isRunEligible,
  itemStatus,
  myBag,
  splitEqually,
  type Item,
  type ListKind,
} from '@yallist/domain';

import type { AvatarPerson } from '@/components/Avatar';
import { he } from '@/i18n/he';
import type { TripData, TripMember } from '@/state/types';

export function initial(name: string): string {
  return name.trim().charAt(0) || '?';
}

export function toAvatar(member: TripMember): AvatarPerson {
  return { initial: initial(member.displayName), color: member.color, photo: member.avatarUrl };
}

/** Everything the trip screens derive from raw trip data, computed once per render. */
export function deriveTrip(data: TripData, me: string) {
  const activeIds = activeMemberIds(data.members);
  const active = data.members.filter((m) => m.status === 'active');
  const memberById = new Map(data.members.map((m) => [m.userId, m]));
  const displayNameOf = (id: string) => memberById.get(id)?.displayName ?? he.unknownPerson;
  /** "אני" for the current user (money rows, chips); use displayNameOf inside third-person phrases. */
  const nameOf = (id: string) => (id === me ? he.me : displayNameOf(id));
  const avatarOf = (id: string): AvatarPerson => {
    const m = memberById.get(id);
    return m ? toAvatar(m) : { initial: '?' };
  };

  const items = [...data.items].sort((a, b) => a.position - b.position);
  const done = (i: Item) => isDone(i, data.claims, data.expenses, activeIds);
  const doneCount = items.filter(done).length;
  const missingIn = (list: ListKind) => items.filter((i) => i.list === list && !done(i)).length;
  const myQuantity = (itemId: string) =>
    claimsFor(itemId, data.claims).find((c) => c.userId === me)?.quantity ?? 0;
  const mine = items.filter((i) => myQuantity(i.id) > 0);
  // Shopping runs under way: mine, and who is buying each item right now.
  const myRun = data.runs.find((r) => r.shopperId === me);
  const activeRuns = new Map(data.runs.map((r) => [r.id, r]));
  const shopperOf = (itemId: string) => {
    const claim = claimsFor(itemId, data.claims).find((c) => c.runId && activeRuns.has(c.runId));
    return claim?.userId;
  };
  const runClaims = (runId: string) => data.claims.filter((c) => c.runId === runId);
  const bought = new Set(data.expenses.flatMap((e) => e.itemIds ?? []));

  return {
    activeIds,
    active,
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
    myRun,
    shopperOf,
    runClaims,
    /** Everything I bring: my claims on the lists, and my private items (התיק שלי). */
    bag: myBag(me, [...items, ...data.privateItems], data.claims, bought),
    /** What a run may claim now: shared buy items nobody has, not bought yet. */
    runEligible: items.filter((i) => isRunEligible(i, data.claims, data.expenses)),
    status: (item: Item) => itemStatus(item, data.claims, data.expenses, activeIds, me),
    /** Who pays whom to settle up, worked out by the API. */
    transfers: data.transfers,
    totalSpent: data.expenses.reduce((sum, e) => sum + e.amountAgorot, 0),
    myShare: data.expenses.reduce(
      (sum, e) => sum + (splitEqually(e.amountAgorot, e.shares).get(me) ?? 0),
      0,
    ),
  };
}

export type TripView = ReturnType<typeof deriveTrip>;
