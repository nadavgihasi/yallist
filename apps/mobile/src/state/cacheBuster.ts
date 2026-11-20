import type { QueryKey } from '@tanstack/react-query';

import type { useBag } from './bag';
import type { useProfile } from './profile';
import type { useReceiptLink } from './receipts';
import type { joinTrip, useInvite, useTripQuery, useTrips } from './trips';

type DataOf<Hook extends (...args: never[]) => { data: unknown }> = NonNullable<
  ReturnType<Hook>['data']
>;

/**
 * The data of every query the cache persists, by the first element of its key: what a new build
 * may find saved by an older one. Taken from the hooks themselves, so a change to the API's
 * response types or to a `queryFn` changes it too.
 */
export interface CachedData {
  trips: DataOf<typeof useTrips>;
  trip: DataOf<typeof useTripQuery>;
  me: DataOf<typeof useProfile>;
  bag: DataOf<typeof useBag>;
  invite: DataOf<typeof useInvite>;
  receipt: DataOf<typeof useReceiptLink>;
  join: Awaited<ReturnType<typeof joinTrip>>;
}

const PERSISTED: Record<keyof CachedData, true> = {
  trips: true,
  trip: true,
  me: true,
  bag: true,
  invite: true,
  receipt: true,
  join: true,
};

/** Only queries described in `CachedData` are saved, so none escapes the shape check. */
export const isPersisted = (queryKey: QueryKey) => Object.hasOwn(PERSISTED, String(queryKey[0]));

/**
 * A fingerprint of `CachedData`'s structure. cacheBuster.test.ts computes it from the types and
 * fails until this matches, so changing the shape of cached data can't ship without a new buster.
 */
export const CACHE_SHAPE = 'dae931aa1599';

/** Bump by hand only when cached data keeps its shape but changes its meaning. */
const CACHE_EPOCH = 1;

/**
 * The persisted query cache's buster: a cache saved under another value is discarded on restore,
 * so a new build never renders data shaped for an older one. Builds that don't change the shape
 * keep the cache, so trips still open offline after an app update or a web deploy.
 */
export const CACHE_BUSTER = `${CACHE_SHAPE}.${CACHE_EPOCH}`;
