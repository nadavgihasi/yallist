import { claimCap, claimsFor, type Claim, type Item } from '@yallist/domain';

/** A `setClaim` for someone: `userId` is left out for me, so mine stays an ordinary claim. */
export interface Assignment {
  quantity: number;
  userId?: string;
  from?: string;
}

/** Whether the "who brings it" picker applies: not to per-person items, which everyone brings. */
export const canAssign = (item: Item) => item.kind !== 'each';

/**
 * What tapping a member in the "who brings it" picker does, or undefined when it can't do
 * anything. Tapping someone who has it takes it off them. Otherwise a single item becomes theirs,
 * moving from whoever has it; a qty item gives them what's still missing.
 * A claim in someone else's shopping run is theirs to change, from the run.
 */
export function assignTap(
  item: Item,
  claims: readonly Claim[],
  userId: string,
  me: string,
): Assignment | undefined {
  if (!canAssign(item)) return undefined;
  const itemClaims = claimsFor(item.id, claims);
  const inOthersRun = (c: Claim | undefined) => !!c?.runId && c.userId !== me;
  const who = userId === me ? {} : { userId };
  const theirs = itemClaims.find((c) => c.userId === userId);
  if (theirs) return inOthersRun(theirs) ? undefined : { ...who, quantity: 0 };
  if (item.kind === 'single') {
    const holder = itemClaims[0];
    if (inOthersRun(holder)) return undefined;
    return { ...who, quantity: item.quantityNeeded, ...(holder && { from: holder.userId }) };
  }
  const cap = claimCap(item, claims, userId);
  return cap > 0 ? { ...who, quantity: cap } : undefined;
}

/**
 * Who has the single item in their shopping run, when that's someone else: then no chip in the
 * picker does anything, and it says why.
 */
export const othersRun = (item: Item, claims: readonly Claim[], me: string) =>
  item.kind === 'single'
    ? claimsFor(item.id, claims).find((c) => c.runId && c.userId !== me)?.userId
    : undefined;
