import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { CategoryForm } from '@/features/trip/CategoryForm';
import { closeSheet } from '@/features/trip/closeSheet';
import { useTripQuery } from '@/state/trips';

export default function EditCategory() {
  const { tripId, categoryId } = useLocalSearchParams<{ tripId: string; categoryId: string }>();
  const query = useTripQuery(tripId);
  const found = !!query.data?.categories.some((c) => c.id === categoryId);
  // Deleted (here or by someone else): nothing left to edit. Opened by URL, wait for the trip.
  const gone = query.data ? !found : query.isError;
  useEffect(() => {
    if (gone) closeSheet(tripId);
  }, [gone, tripId]);
  if (!found) return null;
  return (
    <CategoryForm tripId={tripId} categoryId={categoryId} onClose={() => closeSheet(tripId)} />
  );
}
