import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarStack } from '@/components/Avatar';
import { Progress } from '@/components/Progress';
import { StatusRing } from '@/components/StatusRing';
import { TripTile } from '@/components/TripTile';
import { toAvatar } from '@/features/trip/derive';
import { he, missingItems, openTransfers, participants } from '@/i18n/he';
import { countdown, formatRange, monthName } from '@/lib/dates';
import type { TripSummary } from '@/state/types';
import { colors, radius, space, type } from '@/theme';

/** An upcoming trip (trips.html): tile and name, progress, who's in. */
export function TripCard({ data }: { data: TripSummary }) {
  const { trip, itemCount, doneCount } = data;
  const missing = itemCount - doneCount;
  return (
    <Link href={{ pathname: '/trips/[tripId]', params: { tripId: trip.id } }} asChild>
      <Pressable style={styles.card} accessibilityRole="link">
        <View style={styles.head}>
          <TripTile template={trip.template} />
          <View style={styles.texts}>
            <Text style={styles.name}>{trip.name}</Text>
            <Text style={styles.caption}>
              {formatRange(trip.startsOn, trip.endsOn)} · {participants(data.members.length)}
            </Text>
          </View>
        </View>
        {itemCount === 0 ? (
          <Text style={styles.progressText}>{he.home.noItems}</Text>
        ) : (
          <View style={styles.progress}>
            <View style={styles.progressRow}>
              <Text style={styles.progressText}>{he.trip.coveredOf(doneCount, itemCount)}</Text>
              <Text style={styles.caption}>
                {missing === 0 ? he.trip.allCovered : missingItems(missing)}
              </Text>
            </View>
            <Progress done={doneCount} total={itemCount} />
          </View>
        )}
        {data.mine.length > 0 && (
          <Text style={styles.mine}>
            {he.home.mine}
            {data.mine.join(', ')}
          </Text>
        )}
        <View style={styles.progressRow}>
          <AvatarStack people={data.members.map(toAvatar)} />
          <Text style={styles.caption}>{countdown(trip.startsOn, trip.endsOn)}</Text>
        </View>
      </Pressable>
    </Link>
  );
}

/** A past trip as one row; the check means everyone's settled up. */
export function PastTripRow({ data }: { data: TripSummary }) {
  const { trip } = data;
  // Already only the transfers I'm part of.
  const open = data.transfers.length;
  return (
    <Link href={{ pathname: '/trips/[tripId]', params: { tripId: trip.id } }} asChild>
      <Pressable style={[styles.card, styles.past]} accessibilityRole="link">
        <TripTile template={trip.template} />
        <View style={styles.texts}>
          <Text style={styles.progressText}>{trip.name}</Text>
          <Text style={styles.caption}>
            {monthName(trip.startsOn)} · {participants(data.members.length)}
          </Text>
        </View>
        {open > 0 ? (
          <Text style={styles.mine}>{openTransfers(open)}</Text>
        ) : (
          <StatusRing state="done" label={he.money.settled} />
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space[5],
    borderRadius: radius.card,
    backgroundColor: colors.card,
    gap: space[4],
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  texts: { flex: 1, gap: space[1] },
  name: { ...type.sectionTitle, fontSize: 24, lineHeight: 30, color: colors.ink },
  caption: { ...type.caption, color: colors.inkMuted },
  progress: { gap: space[2] },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  progressText: { ...type.itemTitle, color: colors.ink },
  mine: { ...type.caption, fontFamily: type.itemTitle.fontFamily, color: colors.brandStrong },
  past: { flexDirection: 'row', alignItems: 'center' },
});
