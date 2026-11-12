import type { TripSummary } from '@/state/types';

/**
 * What a past trip's row ends with: my open transfers, how much got arranged if not everything
 * did, or the check, only once everything was arranged and I'm settled up.
 */
export function pastTripState(
  data: Pick<TripSummary, 'itemCount' | 'doneCount' | 'transfers'>,
): 'transfers' | 'partial' | 'done' {
  if (data.transfers.length > 0) return 'transfers';
  if (data.doneCount < data.itemCount) return 'partial';
  return 'done';
}
