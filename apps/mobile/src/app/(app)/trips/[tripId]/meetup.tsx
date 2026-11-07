import { isMeetupPlace, MEETUP_MAX, type LatLng } from '@yallist/domain';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { TextField } from '@/components/Fields';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { useCloseSheet } from '@/features/trip/closeSheet';
import { MeetupMap } from '@/features/trip/map/MeetupMap';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useTrip, useTripAction } from '@/state/trips';

/**
 * Sets where the group meets (organizers): a place's name or a map link, and its point on the
 * map. Both empty clears it.
 */
export default function TripMeetup() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const close = useCloseSheet(tripId);
  const data = useTrip(tripId);
  const act = useTripAction(tripId);
  const [meetup, setMeetup] = useState(data?.trip.meetupText ?? '');
  const [point, setPoint] = useState<LatLng | undefined>(data?.trip.meetupPoint);
  if (!data) return null;

  const meetupText = meetup.trim() || null;
  const meetupPoint = point ?? null;
  const bad = meetupText !== null && !isMeetupPlace(meetupText);
  const { trip } = data;
  const changed =
    meetupText !== (trip.meetupText ?? null) ||
    meetupPoint?.lat !== trip.meetupPoint?.lat ||
    meetupPoint?.lng !== trip.meetupPoint?.lng;
  const save = () => {
    if (bad) return;
    close(() => changed && act({ type: 'setMeetup', meetupText, meetupPoint }));
  };

  return (
    <Sheet
      title={he.links.meetup}
      subtitle={he.links.meetupSubtitle}
      onClose={close}
      footer={
        <PillButton
          label={he.links.save}
          size="lg"
          wide
          disabled={bad}
          {...testId('trip-meetup-save')}
          onPress={save}
        />
      }
    >
      <TextField
        label={he.links.meetupName}
        hint={he.links.meetupHint}
        value={meetup}
        onChangeText={setMeetup}
        placeholder={he.links.meetupPlaceholder}
        maxLength={MEETUP_MAX}
        error={bad ? he.links.badMeetup : undefined}
        {...testId('trip-meetup-name')}
      />
      <MeetupMap
        point={point}
        onPoint={setPoint}
        onName={(name) => !meetup.trim() && setMeetup(name.slice(0, MEETUP_MAX))}
      />
    </Sheet>
  );
}
