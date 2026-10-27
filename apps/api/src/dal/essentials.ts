import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { claims, items, userEssentials } from '../db/schema';
import type { Executor } from '../db/tx';
import { endOfList } from './items';
import { lockProfile } from './profiles';

/** Enough for anyone's packing list, and keeps a copy into a trip far under DSQL's row limit. */
export const MAX_ESSENTIALS = 50;

/** Names compare ignoring case (and the spaces around them). */
const key = (name: string) => name.trim().toLowerCase();

/** The user's essentials' names, in their order. */
export async function listEssentials(tx: Executor, userId: string) {
  const rows = await tx
    .select({ name: userEssentials.name })
    .from(userEssentials)
    .where(eq(userEssentials.userId, userId))
    .orderBy(asc(userEssentials.position));
  return rows.map((r) => r.name);
}

/**
 * set_essentials: replaces the user's essentials with `names`, in that order. A name repeated
 * (ignoring case) is kept once, where it first appears. Returns what was saved.
 */
export async function setEssentials(tx: Executor, userId: string, names: string[]) {
  await lockProfile(tx, userId);
  const seen = new Set<string>();
  const unique = names.filter((n) => !seen.has(key(n)) && seen.add(key(n)));
  await tx.delete(userEssentials).where(eq(userEssentials.userId, userId));
  if (unique.length > 0) {
    await tx
      .insert(userEssentials)
      .values(unique.map((name, position) => ({ userId, name, position })));
  }
  return unique;
}

/**
 * Adds the name at the end of the user's essentials, unless they have it (ignoring case) or
 * already have as many as they can.
 */
export async function saveEssential(tx: Executor, userId: string, name: string) {
  await lockProfile(tx, userId);
  const current = await listEssentials(tx, userId);
  if (current.length >= MAX_ESSENTIALS || current.some((n) => key(n) === key(name))) return;
  await tx.insert(userEssentials).values({ userId, name, position: current.length });
}

/** The user's private items' names in the trip, still in it. */
async function privateNames(tx: Executor, tripId: string, userId: string) {
  const rows = await tx
    .select({ name: items.name })
    .from(items)
    .where(
      and(eq(items.tripId, tripId), eq(items.privateOwnerId, userId), isNull(items.deletedAt)),
    );
  return new Set(rows.map((r) => key(r.name)));
}

/**
 * Copies the user's essentials into the trip as private items in their bag, each claimed by them
 * (create_trip and join_trip). Skips names they already have there as a private item, ignoring
 * case, so joining again never adds them twice.
 */
export async function copyEssentials(tx: Executor, tripId: string, userId: string) {
  const [essentials, have] = await Promise.all([
    listEssentials(tx, userId),
    privateNames(tx, tripId, userId),
  ]);
  const missing = essentials.filter((name) => !have.has(key(name)));
  if (missing.length === 0) return;
  const start = await endOfList(tx, tripId, 'bring');
  const added = await tx
    .insert(items)
    .values(
      missing.map((name, i) => ({
        tripId,
        list: 'bring' as const,
        position: start + i,
        name,
        kind: 'single' as const,
        createdBy: userId,
        privateOwnerId: userId,
        legacyCategory: '',
      })),
    )
    .returning({ id: items.id });
  await tx.insert(claims).values(added.map(({ id }) => ({ itemId: id, userId, quantity: 1 })));
}

/**
 * The names of the user's private items across their trips, newest first, repeats included (the
 * domain's `suggestions` counts them). The most recent few hundred are plenty.
 */
export async function pastPrivateNames(tx: Executor, userId: string) {
  const rows = await tx
    .select({ name: items.name })
    .from(items)
    .where(and(eq(items.privateOwnerId, userId), isNull(items.deletedAt)))
    .orderBy(desc(items.createdAt))
    .limit(300);
  return rows.map((r) => r.name);
}
