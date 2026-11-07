import {
  ALBUM_URL_MAX,
  isMeetupPlace,
  MEETUP_MAX,
  parseAlbumUrl,
  type LatLng,
} from '@yallist/domain';
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
 * Sets the trip's meetup place, its point on the map, and the photo album (organizers); an empty
 * field clears it.
 */
export default function TripLinks() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const close = useCloseSheet(tripId);
  const data = useTrip(tripId);
  const act = useTripAction(tripId);
  const [meetup, setMeetup] = useState(data?.trip.meetupText ?? '');
  const [point, setPoint] = useState<LatLng | undefined>(data?.trip.meetupPoint);
  const [album, setAlbum] = useState(data?.trip.albumUrl ?? '');
  if (!data) return null;

  const meetupText = meetup.trim() || null;
  const albumUrl = album.trim() || null;
  const badMeetup = meetupText !== null && !isMeetupPlace(meetupText);
  const badAlbum = albumUrl !== null && !parseAlbumUrl(albumUrl);
  const meetupPoint = point ?? null;
  const { trip } = data;
  const before = trip.meetupPoint;
  const changed =
    meetupText !== (trip.meetupText ?? null) ||
    albumUrl !== (trip.albumUrl ?? null) ||
    meetupPoint?.lat !== before?.lat ||
    meetupPoint?.lng !== before?.lng;
  const save = () => {
    if (badMeetup || badAlbum) return;
    close(() => changed && act({ type: 'setTripLinks', meetupText, meetupPoint, albumUrl }));
  };

  return (
    <Sheet
      title={he.links.title}
      subtitle={he.links.hint}
      onClose={close}
      footer={
        <PillButton
          label={he.links.save}
          size="lg"
          wide
          disabled={badMeetup || badAlbum}
          {...testId('trip-links-save')}
          onPress={save}
        />
      }
    >
      <TextField
        label={he.links.meetup}
        hint={he.links.meetupHint}
        value={meetup}
        onChangeText={setMeetup}
        placeholder={he.links.meetupPlaceholder}
        maxLength={MEETUP_MAX}
        error={badMeetup ? he.links.badMeetup : undefined}
        {...testId('trip-links-meetup')}
      />
      <MeetupMap
        point={point}
        onPoint={setPoint}
        onName={(name) => !meetup.trim() && setMeetup(name.slice(0, MEETUP_MAX))}
      />
      <TextField
        label={he.links.albumLabel}
        hint={he.links.albumHint}
        value={album}
        onChangeText={setAlbum}
        onSubmitEditing={save}
        returnKeyType="done"
        placeholder="https://photos.app.goo.gl/…"
        inputMode="url"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={ALBUM_URL_MAX}
        error={badAlbum ? he.links.badAlbum : undefined}
        {...testId('trip-links-album')}
      />
    </Sheet>
  );
}
