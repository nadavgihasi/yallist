import type { ListKind } from '@yallist/domain';
import { useLocalSearchParams } from 'expo-router';

import { CategoryForm } from '@/features/trip/CategoryForm';
import { useCloseSheet } from '@/features/trip/closeSheet';

export default function AddCategory() {
  const params = useLocalSearchParams<{ tripId: string; list?: ListKind }>();
  const close = useCloseSheet(params.tripId);
  return (
    <CategoryForm
      tripId={params.tripId}
      list={params.list === 'buy' ? 'buy' : 'bring'}
      onClose={close}
    />
  );
}
