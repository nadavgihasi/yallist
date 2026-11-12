import type { ListKind } from '@yallist/domain';
import { useLocalSearchParams } from 'expo-router';

import { BulkAddSheet } from '@/features/trip/bulk/BulkAddSheet';

/** Adding many items at once; `text` is what the one-item sheet had typed. */
export default function BulkAddItems() {
  const params = useLocalSearchParams<{ tripId: string; list?: ListKind; text?: string }>();
  return (
    <BulkAddSheet
      tripId={params.tripId}
      list={params.list === 'buy' ? 'buy' : 'bring'}
      text={params.text}
    />
  );
}
