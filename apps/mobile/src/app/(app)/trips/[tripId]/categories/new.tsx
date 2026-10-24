import type { ListKind } from '@yallist/domain';
import { useLocalSearchParams } from 'expo-router';

import { CategoryForm } from '@/features/trip/CategoryForm';
import { closeSheet } from '@/features/trip/closeSheet';

export default function AddCategory() {
  const params = useLocalSearchParams<{ tripId: string; list?: ListKind }>();
  return (
    <CategoryForm
      tripId={params.tripId}
      list={params.list === 'buy' ? 'buy' : 'bring'}
      onClose={() => closeSheet(params.tripId)}
    />
  );
}
