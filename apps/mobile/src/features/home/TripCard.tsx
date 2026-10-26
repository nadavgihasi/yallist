import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarStack } from '@/components/Avatar';
import { Countdown } from '@/components/Countdown';
import { Cover } from '@/components/Cover';
import { Pill } from '@/components/Pill';
import { ProgressRing } from '@/components/ProgressRing';
import { StatusRing } from '@/components/StatusRing';
import { TripTile } from '@/components/TripTile';
import { toAvatar } from '@/features/trip/derive';
import { he, missingCount, openTransfers, participants, peopleNames } from '@/i18n/he';
import { formatRange, monthName } from '@/lib/dates';
import type { TripSummary } from '@/state/types';
import { colors, radius, space, type } from '@/theme';

/**
 * An upcoming trip: its scene with the countdown, then name and dates, a ring with what's missing
 * and what's mine, and who's in. `now` comes from `useToday()`.
 */
export function TripCard({ data, now }: { data: TripSummary; now: string }) {
  const { trip, itemCount, doneCount } = data;
  const missing = itemCount - doneCount;
  return (
    <Link href={{ pathname: '/trips/[tripId]', params: { tripId: trip.id } }} asChild>
      <Pressable style={styles.card} accessibilityRole="link">
        <Cover scene={trip.cover} style={styles.cover} testID={`trip-card-cover-${trip.cover}`}>
          <View style={styles.countdown}>
            <Countdown startsOn={trip.startsOn} endsOn={trip.endsOn} now={now} />
          </View>
        </Cover>
        <View style={styles.body}>
          <View style={styles.texts}>
            <Text style={styles.name}>{trip.name}</Text>
            <Text style={styles.caption}>{formatRange(trip.startsOn, trip.endsOn)}</Text>
          </View>
          {itemCount === 0 ? (
            <Text style={styles.caption}>{he.home.noItems}</Text>
          ) : (
            <View style={styles.row}>
              <ProgressRing done={doneCount} total={itemCount} />
              <View style={styles.pills}>
                <Pill label={missing === 0 ? he.trip.allCovered : missingCount(missing)} />
                {data.mine.length > 0 && (
                  <Pill label={he.status.mineQty(data.mine.length)} tone="brand" />
                )}
              </View>
            </View>
          )}
          <AvatarStack
            people={data.members.map(toAvatar)}
            max={4}
            label={peopleNames(data.members.map((m) => m.displayName))}
          />
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
  card: { borderRadius: radius.card, backgroundColor: colors.card, overflow: 'hidden' },
  cover: { height: 88 },
  countdown: { position: 'absolute', top: space[3], start: space[3] },
  body: { padding: space[5], gap: space[4] },
  texts: { flex: 1, gap: space[1] },
  name: { ...type.sectionTitle, fontSize: 24, lineHeight: 30, color: colors.ink },
  caption: { ...type.caption, color: colors.inkMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], flexShrink: 1 },
  progressText: { ...type.itemTitle, color: colors.ink },
  mine: { ...type.caption, fontFamily: type.itemTitle.fontFamily, color: colors.brandStrong },
  past: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    padding: space[5],
  },
});
