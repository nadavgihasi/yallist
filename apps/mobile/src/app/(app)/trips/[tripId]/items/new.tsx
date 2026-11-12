import type { ListKind } from '@yallist/domain';
import { useLocalSearchParams } from 'expo-router';

import { saved } from '@/features/trip/addItem';
import { useCloseSheet } from '@/features/trip/closeSheet';
import { ItemForm } from '@/features/trip/ItemForm';
import { useTripAction } from '@/state/trips';

export default function AddItem() {
  const params = useLocalSearchParams<{ tripId: string; list?: ListKind; categoryId?: string }>();
  const act = useTripAction(params.tripId);
  const close = useCloseSheet(params.tripId);
  return (
    <ItemForm
      tripId={params.tripId}
      list={params.list === 'buy' ? 'buy' : 'bring'}
      categoryId={params.categoryId}
      // Closes once saved: a failed save keeps the sheet, and what was typed, open.
      onSubmit={(item, claim, newCategory) =>
        saved(act, {
          type: 'addItem',
          item,
          claim: claim ? item.quantityNeeded : 0,
          newCategory,
        }).then(() => close())
      }
      onClose={close}
    />
  );
}
