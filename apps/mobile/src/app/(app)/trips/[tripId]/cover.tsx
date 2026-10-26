import { useLocalSearchParams } from 'expo-router';

import { CoverPicker } from '@/components/CoverPicker';
import { Sheet } from '@/components/Sheet';
import { useCloseSheet } from '@/features/trip/closeSheet';
import { he } from '@/i18n/he';
import { useTrip, useTripAction } from '@/state/trips';

/** Picks the trip's cover (organizers): a tap saves it and closes the sheet. */
export default function TripCover() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const close = useCloseSheet(tripId);
  const data = useTrip(tripId);
  const act = useTripAction(tripId);
  if (!data) return null;
  const { cover } = data.trip;
  return (
    <Sheet title={he.cover.title} subtitle={he.cover.hint} onClose={close}>
      <CoverPicker
        value={cover}
        onChange={(next) => close(() => next !== cover && act({ type: 'setCover', cover: next }))}
      />
    </Sheet>
  );
}
