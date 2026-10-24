import type { ListKind } from '@yallist/domain';
import { useLocalSearchParams } from 'expo-router';

import { closeSheet } from '@/features/trip/closeSheet';
import { ItemForm } from '@/features/trip/ItemForm';
import { useTripAction } from '@/state/trips';

export default function AddItem() {
  const params = useLocalSearchParams<{ tripId: string; list?: ListKind; categoryId?: string }>();
  const act = useTripAction(params.tripId);
  const close = () => closeSheet(params.tripId);
  return (
    <ItemForm
      tripId={params.tripId}
      list={params.list === 'buy' ? 'buy' : 'bring'}
      categoryId={params.categoryId}
      onSubmit={(item, claim, newCategory) => {
        act({ type: 'addItem', item, claim: claim ? item.quantityNeeded : 0, newCategory });
        close();
      }}
      onClose={close}
    />
  );
}
