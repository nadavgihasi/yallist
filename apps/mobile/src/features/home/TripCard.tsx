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
import {
  he,
  missingCount,
  missingNames,
  openTransfers,
  participants,
  peopleNames,
} from '@/i18n/he';
import { formatRange, monthName } from '@/lib/dates';
import { testId } from '@/lib/testId';
import type { TripSummary } from '@/state/types';
import { colors, space, surface, type } from '@/theme';

import { pastTripState } from './pastTrip';

/**
 * An upcoming trip: its scene with the countdown, then name and dates, a ring with what's missing
 * and what's mine, and who's in. `now` comes from `useToday()`. The `next` trip also names the
 * first few missing items.
 */
export function TripCard({
  data,
  now,
  next = false,
}: {
  data: TripSummary;
  now: string;
  next?: boolean;
}) {
  const { trip, itemCount, doneCount } = data;
  const missing = itemCount - doneCount;
  return (
    <Link href={{ pathname: '/trips/[tripId]', params: { tripId: trip.id } }} asChild>
      <Pressable
        style={styles.card}
        accessibilityRole="link"
        {...testId(next ? 'home-next-trip' : undefined)}
      >
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
              <View style={styles.side}>
                <View style={styles.pills}>
                  <Pill label={missing === 0 ? he.trip.allCovered : missingCount(missing)} />
                  {data.mine.length > 0 && (
                    <Pill label={he.status.mineQty(data.mine.length)} tone="brand" />
                  )}
                </View>
                {next && missing > 0 && (
                  <Text style={styles.missing} numberOfLines={1}>
                    {missingNames(data.missingNames, missing)}
                  </Text>
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

/**
 * A past trip as one row, ending with my open transfers, how much got arranged (`0/24`) or, once
 * everything was arranged and I'm settled up, a check.
 */
export function PastTripRow({ data }: { data: TripSummary }) {
  const { trip } = data;
  // Already only the transfers I'm part of.
  const open = data.transfers.length;
  const state = pastTripState(data);
  return (
    <Link href={{ pathname: '/trips/[tripId]', params: { tripId: trip.id } }} asChild>
      <Pressable style={styles.past} accessibilityRole="link" {...testId('home-past-trip')}>
        <TripTile template={trip.template} />
        <View style={styles.texts}>
          <Text style={styles.progressText}>{trip.name}</Text>
          <Text style={styles.caption}>
            {monthName(trip.startsOn)} · {participants(data.members.length)}
          </Text>
        </View>
        {state === 'transfers' ? (
          <Text style={styles.mine}>{openTransfers(open)}</Text>
        ) : state === 'partial' ? (
          <ProgressRing done={data.doneCount} total={data.itemCount} />
        ) : (
          <StatusRing state="done" label={he.money.settled} />
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { ...surface, overflow: 'hidden' },
  cover: { height: 88 },
  countdown: { position: 'absolute', top: space[3], start: space[3] },
  body: { padding: space[5], gap: space[4] },
  texts: { flex: 1, gap: space[1] },
  name: { ...type.sectionTitle, color: colors.ink },
  caption: { ...type.caption, color: colors.inkMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  side: { flexShrink: 1, gap: space[2] },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  missing: { ...type.caption, color: colors.ink },
  progressText: { ...type.itemTitle, color: colors.ink },
  mine: { ...type.caption, fontFamily: type.itemTitle.fontFamily, color: colors.brandStrong },
  // One object, not `[card, past]`: an array style on the `Link asChild` Pressable reaches the DOM
  // as indexed keys on web and crashes the home screen (YALLIST-APP-1).
  past: {
    ...surface,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    padding: space[5],
  },
});
