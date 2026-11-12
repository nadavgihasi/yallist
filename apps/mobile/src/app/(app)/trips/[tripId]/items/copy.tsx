import { useLocalSearchParams } from 'expo-router';

import { CopyFromTripSheet } from '@/features/trip/bulk/CopyFromTripSheet';

/** Copying items from a previous trip of mine. */
export default function CopyItems() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  return <CopyFromTripSheet tripId={tripId} />;
}
