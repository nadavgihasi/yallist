import type { ListKind } from '@yallist/domain';
import { onlineManager } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';

import { saved } from '@/features/trip/addItem';
import { useCloseSheet } from '@/features/trip/closeSheet';
import { ItemForm } from '@/features/trip/ItemForm';
import { requestReveal } from '@/features/trip/reveal';
import { awaitAnswer, useTripAction } from '@/state/trips';

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
      onSubmit={(item, claim, newCategory) => {
        // Back on the trip, its list scrolls to the new item and marks it.
        requestReveal(params.tripId, { kind: 'item', list: item.list, name: item.name });
        return saved(
          (action, answer) => {
            awaitAnswer(action, answer);
            act(action);
          },
          { type: 'addItem', item, claim: claim ? item.quantityNeeded : 0, newCategory },
          onlineManager.isOnline(),
        ).then(() => close());
      }}
      // The item the list already has, instead of this sheet.
      onOpen={(itemId) =>
        router.replace({
          pathname: '/trips/[tripId]/items/[itemId]',
          params: { tripId: params.tripId, itemId },
        })
      }
      onClose={close}
    />
  );
}
