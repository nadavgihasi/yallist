import { bagSuggestions, type BagItem } from '@yallist/domain';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { CheckRow } from '@/components/CheckRow';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { useTakeFromBag } from '@/features/trip/BagCards';
import { useCloseSheet } from '@/features/trip/closeSheet';
import { deriveTrip } from '@/features/trip/derive';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useBag } from '@/state/bag';
import { useMe } from '@/state/store';
import { useTrip } from '@/state/trips';
import type { TripData } from '@/state/types';
import { space } from '@/theme';

/** "What's on you?": pick which common items in my bag, that nobody brings yet, I'll bring. */
export default function TakeFromBag() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const data = useTrip(tripId);
  const bag = useBag().data;
  if (!data || !bag) return null;
  return <TakeFromBagBody data={data} bag={bag} />;
}

function TakeFromBagBody({ data, bag }: { data: TripData; bag: readonly BagItem[] }) {
  const me = useMe().userId;
  const tripId = data.trip.id;
  const close = useCloseSheet(tripId);
  const take = useTakeFromBag(tripId);
  const offers = bagSuggestions(deriveTrip(data, me).items, data.claims, bag);
  // Every one starts checked; ones someone takes meanwhile drop out.
  const [unpicked, setUnpicked] = useState<ReadonlySet<string>>(new Set());
  const picked = offers.filter((o) => !unpicked.has(o.item.id));
  const toggle = (id: string) =>
    setUnpicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <Sheet
      title={he.bag.chooseTitle}
      subtitle={he.bag.chooseCaption}
      onClose={close}
      gap={space[3]}
      footer={
        <PillButton
          label={picked.length === 0 ? he.bag.pickOne : he.bag.chooseSave(picked.length)}
          size="lg"
          wide
          disabled={picked.length === 0}
          onPress={() => close(() => take(picked))}
          {...testId('bag-choose-save')}
        />
      }
    >
      <View>
        {offers.map(({ item, quantity }) => (
          <CheckRow
            key={item.id}
            label={item.name}
            detail={
              quantity < item.quantityNeeded
                ? he.bag.partOf(quantity, item.quantityNeeded)
                : undefined
            }
            checked={!unpicked.has(item.id)}
            onToggle={() => toggle(item.id)}
          />
        ))}
      </View>
    </Sheet>
  );
}
