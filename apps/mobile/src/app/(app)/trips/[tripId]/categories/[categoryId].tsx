import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { CategoryForm } from '@/features/trip/CategoryForm';
import { closeSheet } from '@/features/trip/closeSheet';
import { useTrip } from '@/state/trips';

export default function EditCategory() {
  const { tripId, categoryId } = useLocalSearchParams<{ tripId: string; categoryId: string }>();
  const data = useTrip(tripId);
  // Deleted (here or by someone else): nothing left to edit.
  const missing = !data?.categories.some((c) => c.id === categoryId);
  useEffect(() => {
    if (missing) closeSheet(tripId);
  }, [missing, tripId]);
  if (missing) return null;
  return (
    <CategoryForm tripId={tripId} categoryId={categoryId} onClose={() => closeSheet(tripId)} />
  );
}
