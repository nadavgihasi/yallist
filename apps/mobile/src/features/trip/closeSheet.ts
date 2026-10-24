import { router } from 'expo-router';

/** Back to whatever opened the sheet; opened by URL, fall back to its trip rather than home. */
export function closeSheet(tripId: string) {
  if (router.canGoBack()) router.back();
  else router.dismissTo({ pathname: '/trips/[tripId]', params: { tripId } });
}
