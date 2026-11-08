import { ALBUM_URL_MAX, parseAlbumUrl } from '@yallist/domain';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { TextField } from '@/components/Fields';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { useCloseSheet } from '@/features/trip/closeSheet';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useTrip, useTripAction } from '@/state/trips';

/** Sets the trip's photo album (organizers): a Google Photos link. Empty clears it. */
export default function TripAlbum() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const close = useCloseSheet(tripId);
  const data = useTrip(tripId);
  const act = useTripAction(tripId);
  const [album, setAlbum] = useState(data?.trip.albumUrl ?? '');
  if (!data) return null;

  const albumUrl = album.trim() || null;
  const bad = albumUrl !== null && !parseAlbumUrl(albumUrl);
  const changed = albumUrl !== (data.trip.albumUrl ?? null);
  const save = () => {
    if (bad) return;
    close(() => changed && act({ type: 'setAlbum', albumUrl }));
  };

  return (
    <Sheet
      title={he.links.albumLabel}
      subtitle={he.links.albumSubtitle}
      onClose={close}
      footer={
        <PillButton
          label={he.links.save}
          size="lg"
          wide
          disabled={bad}
          {...testId('trip-album-save')}
          onPress={save}
        />
      }
    >
      <TextField
        label={he.links.albumLink}
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
        error={bad ? he.links.badAlbum : undefined}
        {...testId('trip-album-url')}
      />
    </Sheet>
  );
}
