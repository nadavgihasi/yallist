import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarStack } from '@/components/Avatar';
import { Cover } from '@/components/Cover';
import { glassStyle } from '@/components/GlassTabBar';
import { Pegs } from '@/components/Pegs';
import { deriveTrip, toAvatar } from '@/features/trip/derive';
import { he, itemsCount } from '@/i18n/he';
import { countdown, formatRange, monthName } from '@/lib/dates';
import type { TripData } from '@/state/types';
import { colors, fonts, radius } from '@/theme';

export function TripCard({ data, me, large }: { data: TripData; me: string; large: boolean }) {
  const view = deriveTrip(data, me);
  const { trip } = data;
  const missing = view.missingCount;
  return (
    <Link href={{ pathname: '/trips/[tripId]', params: { tripId: trip.id } }} asChild>
      <Pressable style={styles.card} accessibilityRole="link">
        <Cover scene={trip.template} style={{ height: large ? 172 : 120 }}>
          <View style={[styles.countdown, glassStyle]}>
            <Text style={styles.countdownText}>{countdown(trip.startsOn, trip.endsOn)}</Text>
          </View>
        </Cover>
        <View style={[styles.body, { gap: large ? 14 : 12 }]}>
          <View style={styles.titles}>
            <Text style={[styles.name, { fontSize: large ? 26 : 22 }]}>{trip.name}</Text>
            <Text style={styles.dates}>{formatRange(trip.startsOn, trip.endsOn)}</Text>
          </View>
          <Pegs done={view.doneCount} total={view.items.length} height={8} />
          <View style={styles.row}>
            <View style={styles.counts}>
              <Text style={[styles.missing, missing === 0 && { color: colors.success }]}>
                {missing === 0 ? he.trip.allCovered : `${itemsCount(missing)} חסרים`}
              </Text>
              {large && view.items.length > 0 && (
                <Text style={styles.meta}>
                  {he.trip.coveredOf(view.doneCount, view.items.length)}
                </Text>
              )}
            </View>
            <AvatarStack people={data.members.map((m) => toAvatar(m, me))} />
          </View>
          {large && view.mine.length > 0 && (
            <Text style={styles.mine}>
              {he.home.mine}
              {view.mine.map((i) => i.name).join(', ')}
            </Text>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

export function PastTripRow({ data }: { data: TripData }) {
  const { trip } = data;
  return (
    <Link href={{ pathname: '/trips/[tripId]', params: { tripId: trip.id } }} asChild>
      <Pressable style={styles.past} accessibilityRole="link">
        <Cover scene={trip.template} style={styles.thumb} />
        <View style={styles.titles}>
          <Text style={styles.pastName}>{trip.name}</Text>
          <Text style={styles.dates}>
            {monthName(trip.startsOn)}, {data.members.length} משתתפים
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, backgroundColor: colors.surface, overflow: 'hidden' },
  countdown: {
    position: 'absolute',
    top: 12,
    start: 12,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    justifyContent: 'center',
  },
  countdownText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  body: { padding: 18 },
  titles: { gap: 4, flex: 1 },
  name: { fontFamily: fonts.display, color: colors.ink },
  dates: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkSecondary },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  counts: { gap: 2 },
  missing: { fontFamily: fonts.semibold, fontSize: 15, color: colors.missing },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkSecondary },
  mine: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.accentTint,
    color: colors.accent,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  past: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: radius.group,
    backgroundColor: colors.surface,
  },
  thumb: { width: 64, height: 64, borderRadius: 18 },
  pastName: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink },
});
