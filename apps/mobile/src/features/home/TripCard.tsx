import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarStack } from '@/components/Avatar';
import { Cover } from '@/components/Cover';
import { glassStyle } from '@/components/GlassTabBar';
import { Progress } from '@/components/Progress';
import { toAvatar } from '@/features/trip/derive';
import { he, missingItems, openTransfers, participants } from '@/i18n/he';
import { countdown, formatRange, monthName } from '@/lib/dates';
import type { TripSummary } from '@/state/types';
import { colors, fonts, radius } from '@/theme';

export function TripCard({ data, me, large }: { data: TripSummary; me: string; large: boolean }) {
  const { trip, itemCount, doneCount } = data;
  const missing = itemCount - doneCount;
  return (
    <Link href={{ pathname: '/trips/[tripId]', params: { tripId: trip.id } }} asChild>
      <Pressable style={styles.card} accessibilityRole="link">
        <Cover scene={trip.template} style={{ height: large ? 172 : 120 }}>
          <View style={[styles.countdown, glassStyle]}>
            <Text style={styles.countdownText}>{countdown(trip.startsOn, trip.endsOn)}</Text>
          </View>
        </Cover>
        <View style={[styles.body, { gap: large ? 14 : 12 }, !large && { paddingTop: 16 }]}>
          <View style={styles.titles}>
            <Text style={[styles.name, { fontSize: large ? 26 : 22 }]}>{trip.name}</Text>
            <Text style={styles.dates}>{formatRange(trip.startsOn, trip.endsOn)}</Text>
          </View>
          <Progress done={doneCount} total={itemCount} />
          <View style={styles.row}>
            <View style={styles.counts}>
              {itemCount === 0 ? (
                <Text style={[styles.missing, { color: colors.inkMuted }]}>{he.home.noItems}</Text>
              ) : (
                <Text style={[styles.missing, missing === 0 && { color: colors.inkMuted }]}>
                  {missing === 0 ? he.trip.allCovered : missingItems(missing)}
                </Text>
              )}
              {large && itemCount > 0 && (
                <Text style={styles.meta}>{he.trip.coveredOf(doneCount, itemCount)}</Text>
              )}
            </View>
            <AvatarStack people={data.members.map((m) => toAvatar(m))} />
          </View>
          {large && data.mine.length > 0 && (
            <Text style={styles.mine}>
              {he.home.mine}
              {data.mine.join(', ')}
            </Text>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

export function PastTripRow({ data }: { data: TripSummary }) {
  const { trip } = data;
  // Already only the transfers I'm part of.
  const open = data.transfers.length;
  return (
    <Link href={{ pathname: '/trips/[tripId]', params: { tripId: trip.id } }} asChild>
      <Pressable style={styles.past} accessibilityRole="link">
        <Cover scene={trip.template} style={styles.thumb} />
        <View style={styles.titles}>
          <Text style={styles.pastName}>{trip.name}</Text>
          <Text style={styles.dates}>
            {monthName(trip.startsOn)}, {participants(data.members.length)}
          </Text>
        </View>
        {open > 0 && (
          <View style={styles.openBadge}>
            <Text style={styles.openText}>{openTransfers(open)}</Text>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, backgroundColor: colors.card, overflow: 'hidden' },
  countdown: {
    position: 'absolute',
    top: 12,
    start: 12,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    justifyContent: 'center',
  },
  countdownText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  body: { padding: 18 },
  titles: { gap: 4, flex: 1 },
  name: { fontFamily: fonts.extraBold, color: colors.ink },
  dates: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  counts: { gap: 2 },
  missing: { fontFamily: fonts.bold, fontSize: 15, color: colors.brandStrong },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted },
  mine: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.primaryTint,
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  past: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: colors.card,
  },
  thumb: { width: 64, height: 64, borderRadius: 18 },
  openBadge: {
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: colors.ground,
    justifyContent: 'center',
  },
  openText: { fontFamily: fonts.bold, fontSize: 13, color: colors.brandStrong },
  pastName: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
});
