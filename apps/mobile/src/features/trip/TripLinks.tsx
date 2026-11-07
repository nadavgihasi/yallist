import { meetupLinks, parseMapLink } from '@yallist/domain';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Card } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { showToast } from '@/components/Toast';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import type { TripData } from '@/state/types';
import { colors, space, type } from '@/theme';

/**
 * The native app where one is installed (Waze, Google Maps, Photos); a new tab on web, where
 * expo-linking would replace the app's page instead.
 */
function open(url: string) {
  if (Platform.OS === 'web') return void window.open(url, '_blank', 'noopener');
  Linking.openURL(url).catch(() => showToast(he.errors.failed, 'error'));
}

/**
 * The trip's meetup place or its point on the map, with buttons to navigate there, and its photo album. Organizers edit
 * them; with neither set, they get a quiet button to add them and everyone else sees nothing.
 */
export function TripLinks({ trip, organizer }: { trip: TripData['trip']; organizer: boolean }) {
  const { meetupText, meetupPoint, albumUrl } = trip;
  const meetup = meetupText !== undefined || meetupPoint !== undefined;
  const edit = () =>
    router.push({ pathname: '/trips/[tripId]/links', params: { tripId: trip.id } });

  if (!meetup && !albumUrl) {
    return organizer ? (
      <PillButton
        label={he.links.add}
        variant="quiet"
        size="sm"
        icon={<Icon name="plus" size={16} color={colors.inkMuted} />}
        {...testId('trip-links-add')}
        onPress={edit}
        style={styles.add}
      />
    ) : null;
  }

  const links = meetupLinks(meetupText, meetupPoint);
  // A pasted link says nothing to read: it shows as "a place on the map", as a picked point does.
  const placeName = meetupText && !parseMapLink(meetupText) ? meetupText : he.links.mapLink;
  return (
    <Card gap={space[3]}>
      <View style={styles.header}>
        <View style={styles.texts}>
          <Text style={styles.title}>{meetup ? he.links.meetup : he.links.albumLabel}</Text>
          {meetup && (
            <Text style={styles.place} {...testId('trip-meetup-text')}>
              {placeName}
            </Text>
          )}
        </View>
        {organizer && (
          <PillButton
            label={he.links.edit}
            accessibilityLabel={he.links.editLabel}
            variant="quiet"
            size="sm"
            icon={<Icon name="pencil" size={16} color={colors.inkMuted} />}
            {...testId('trip-links-edit')}
            onPress={edit}
          />
        )}
      </View>
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
      {albumUrl && (
        <PillButton
          label={he.links.album}
          variant="soft"
          icon={<Icon name="image" size={18} color={colors.primaryStrong} />}
          {...testId('trip-album')}
          onPress={() => open(albumUrl)}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  add: { alignSelf: 'flex-start' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  texts: { flex: 1, gap: space[1] },
  title: { ...type.itemTitle, color: colors.ink },
  place: { ...type.caption, color: colors.inkMuted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  grow: { flexGrow: 1 },
});
