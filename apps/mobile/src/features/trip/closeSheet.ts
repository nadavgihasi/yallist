import { router } from 'expo-router';
import { useCallback, useRef } from 'react';

/** Back to whatever opened the sheet; opened by URL, fall back to its trip rather than home. */
function closeSheet(tripId: string) {
  if (router.canGoBack()) router.back();
  else router.dismissTo({ pathname: '/trips/[tripId]', params: { tripId } });
}

/**
 * Closes the sheet exactly once, running `then` (the change it saves) on that first call only.
 * A sheet on its way out still takes a second tap or Enter: closing again would also pop the
 * trip screen, and saving again would add the item or expense twice.
 */
export function useCloseSheet(tripId: string) {
  const closed = useRef(false);
  return useCallback(
    (then?: () => void) => {
      if (closed.current) return;
      closed.current = true;
      then?.();
      closeSheet(tripId);
    },
    [tripId],
  );
}
