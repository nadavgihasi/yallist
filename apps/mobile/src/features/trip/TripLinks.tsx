import { meetupLinks, parseMapLink } from '@yallist/domain';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Card } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { showToast } from '@/components/Toast';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import type { TripData } from '@/state/types';
import { colors, space, type } from '@/theme';

type Trip = TripData['trip'];

/**
 * The native app where one is installed (Waze, Google Maps, Photos); a new tab on web, where
 * expo-linking would replace the app's page instead.
 */
function open(url: string) {
  if (Platform.OS === 'web') return void window.open(url, '_blank', 'noopener');
  Linking.openURL(url).catch(() => showToast(he.errors.failed, 'error'));
}

/**
 * A section of the ניהול tab: its title, what's set (`children`) and, for organizers, a button
 * to edit it. Unset, organizers get a line on what it's for and a button to add it; everyone else
 * sees nothing.
 */
function Section({
  title,
  icon,
  set,
  hint,
  addLabel,
  editLabel,
  organizer,
  sheet,
  tripId,
  id,
  children,
}: {
  title: string;
  icon: IconName;
  set: boolean;
  hint: string;
  addLabel: string;
  editLabel: string;
  organizer: boolean;
  sheet: 'meetup' | 'album';
  tripId: string;
  /** testID prefix: `${id}-add`, `${id}-edit`. */
  id: string;
  children: ReactNode;
}) {
  if (!set && !organizer) return null;
  const edit = () => router.push({ pathname: `/trips/[tripId]/${sheet}`, params: { tripId } });
  return (
    <Card gap={space[3]}>
      <View style={styles.header}>
        <Icon name={icon} size={20} color={colors.inkMuted} />
        <Text style={styles.title}>{title}</Text>
        {set && organizer && (
          <PillButton
            label={he.links.edit}
            accessibilityLabel={editLabel}
            variant="quiet"
            size="sm"
            icon={<Icon name="pencil" size={16} color={colors.inkMuted} />}
            {...testId(`${id}-edit`)}
            onPress={edit}
          />
        )}
      </View>
      {set ? (
        children
      ) : (
        <>
          <Text style={styles.text}>{hint}</Text>
          <PillButton
            label={addLabel}
            variant="soft"
            icon={<Icon name="plus" size={16} color={colors.primaryStrong} />}
            {...testId(`${id}-add`)}
            onPress={edit}
            style={styles.start}
          />
        </>
      )}
    </Card>
  );
}

/** Where the group meets: the place, with buttons to navigate there in Waze or Google Maps. */
export function MeetupSection({ trip, organizer }: { trip: Trip; organizer: boolean }) {
  const { meetupText, meetupPoint } = trip;
  const links = meetupLinks(meetupText, meetupPoint);
  // A pasted link says nothing to read: it shows as "a place on the map", as a picked point does.
  const placeName = meetupText && !parseMapLink(meetupText) ? meetupText : he.links.mapLink;
  return (
    <Section
      title={he.links.meetup}
      icon="pin"
      set={links !== undefined}
      hint={he.links.meetupEmpty}
      addLabel={he.links.addMeetup}
      editLabel={he.links.editMeetup}
      organizer={organizer}
      sheet="meetup"
      tripId={trip.id}
      id="trip-meetup"
    >
      <Text style={styles.text} {...testId('trip-meetup-text')}>
        {placeName}
      </Text>
      {links &&
        ('link' in links ? (
          <PillButton
            label={he.links.openLink}
            variant="soft"
            {...testId('trip-meetup-link')}
            onPress={() => open(links.link)}
          />
        ) : (
          <View style={styles.row}>
            <PillButton
              label={he.links.waze}
              variant="soft"
              {...testId('trip-meetup-waze')}
              onPress={() => open(links.waze)}
              style={styles.grow}
            />
            <PillButton
              label={he.links.maps}
              variant="soft"
              {...testId('trip-meetup-maps')}
              onPress={() => open(links.maps)}
              style={styles.grow}
            />
          </View>
        ))}
    </Section>
  );
}

/** The trip's photo album, to open in Google Photos. */
export function AlbumSection({ trip, organizer }: { trip: Trip; organizer: boolean }) {
  const { albumUrl } = trip;
  return (
    <Section
      title={he.links.albumLabel}
      icon="image"
      set={albumUrl !== undefined}
      hint={he.links.albumEmpty}
      addLabel={he.links.addAlbum}
      editLabel={he.links.editAlbum}
      organizer={organizer}
      sheet="album"
      tripId={trip.id}
      id="trip-album"
    >
      {albumUrl && (
        <PillButton
          label={he.links.album}
          variant="soft"
          icon={<Icon name="image" size={18} color={colors.primaryStrong} />}
          {...testId('trip-album-open')}
          onPress={() => open(albumUrl)}
        />
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  title: { ...type.itemTitle, color: colors.ink, flex: 1 },
  text: { ...type.caption, color: colors.inkMuted },
  start: { alignSelf: 'flex-start' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  grow: { flexGrow: 1 },
});
