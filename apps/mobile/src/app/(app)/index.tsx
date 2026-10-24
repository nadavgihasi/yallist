import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Cover } from '@/components/Cover';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { PastTripRow, TripCard } from '@/features/home/TripCard';
import { initial } from '@/features/trip/derive';
import { he, upcomingCount } from '@/i18n/he';
import { daysBetween, today } from '@/lib/dates';
import { useMe } from '@/state/store';
import { useTrips } from '@/state/trips';
import { colors, fonts, radius } from '@/theme';
import { contentMaxWidth, useBreakpoint } from '@/theme/breakpoint';

export default function Home() {
  const me = useMe();
  const trips = useTrips();
  const insets = useSafeAreaInsets();
  const bp = useBreakpoint();
  const wide = bp !== 'phone';
  const { width } = useWindowDimensions();
  // Measured, so a desktop scrollbar can't push the last column onto a new row.
  const [gridWidth, setGridWidth] = useState(0);
  // Wide screens: trip cards in a grid inside a centered column, "new trip" in the top bar.
  const pad = wide ? 32 : 16;
  const cols = bp === 'desktop' ? 3 : bp === 'tablet' ? 2 : 1;
  const gap = wide ? 20 : 16;
  const measure = (e: LayoutChangeEvent) => setGridWidth(e.nativeEvent.layout.width);
  const cell = {
    width: Math.floor(
      ((gridWidth || Math.min(width, contentMaxWidth) - 2 * pad) - gap * (cols - 1)) / cols,
    ),
  };

  // The API sorts them by start date.
  const all = trips.data?.trips ?? [];
  const now = today();
  const upcoming = all.filter((t) => daysBetween(now, t.trip.endsOn) >= 0);
  // Trips already under way stay in the list but aren't "בקרוב".
  const soon = upcoming.filter((t) => t.trip.startsOn > now).length;
  const past = all.filter((t) => daysBetween(now, t.trip.endsOn) < 0).reverse();
  const empty = trips.isSuccess && all.length === 0;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: (wide ? 40 : 24) + insets.top, paddingHorizontal: pad, gap },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.titles}>
            <Text style={styles.h1} accessibilityRole="header">
              {he.home.title}
            </Text>
            {soon > 0 && <Text style={styles.subtitle}>{upcomingCount(soon)}</Text>}
          </View>
          {wide && (
            <PillButton
              label={empty ? he.firstHome.cta : he.home.newTrip}
              size="lg"
              icon={<Icon name="plus" color={colors.onPrimary} />}
              onPress={() => router.push('/trips/new')}
            />
          )}
          <View accessibilityLabel={me.name}>
            <Avatar person={{ initial: initial(me.name) }} size={44} ring={false} />
          </View>
        </View>

        {trips.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.status} />
        ) : trips.isError && !trips.data ? (
          <Pressable onPress={() => trips.refetch()} style={styles.status}>
            <Text style={styles.subtitle}>{he.errors.loadFailed}</Text>
            <Text style={styles.retry}>{he.errors.retry}</Text>
          </Pressable>
        ) : empty ? (
          <FirstHome side={bp === 'desktop'} />
        ) : (
          <>
            <View style={[styles.grid, { gap }]} onLayout={measure}>
              {upcoming.map((t, i) => (
                <View key={t.trip.id} style={cell}>
                  <TripCard data={t} me={me.userId} large={wide || i === 0} />
                </View>
              ))}
            </View>
            {past.length > 0 && <Text style={styles.h2}>{he.home.past}</Text>}
            <View style={[styles.grid, { gap: wide ? 12 : gap }]} onLayout={measure}>
              {past.map((t) => (
                <View key={t.trip.id} style={cell}>
                  <PastTripRow data={t} />
                </View>
              ))}
            </View>
          </>
        )}
        <View style={wide ? styles.spacerWide : styles.spacer} />
      </ScrollView>
      {!wide && (
        <View style={[styles.ctaWrap, { bottom: 24 + insets.bottom }]} pointerEvents="box-none">
          <PillButton
            label={empty ? he.firstHome.cta : he.home.newTrip}
            size="lg"
            icon={<Icon name="plus" color={colors.onPrimary} />}
            onPress={() => router.push('/trips/new')}
            style={styles.cta}
          />
        </View>
      )}
    </View>
  );
}

/** `side`: the intro card and the steps side by side (desktop). */
function FirstHome({ side }: { side: boolean }) {
  return (
    <View style={side ? styles.firstSide : styles.firstStack}>
      <View style={[styles.card, side && styles.half]}>
        <Cover scene="camp" style={{ height: 180 }} />
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle}>{he.firstHome.emptyTitle}</Text>
          <Text style={styles.cardText}>{he.firstHome.emptyText}</Text>
        </View>
      </View>
      <View style={[styles.steps, side && styles.half]}>
        {he.firstHome.steps.map(([title, text], i) => (
          <View key={title} style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <View style={styles.stepTexts}>
              <Text style={styles.stepTitle}>{title}</Text>
              <Text style={styles.stepText}>{text}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  firstStack: { gap: 16 },
  firstSide: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  half: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  titles: { flex: 1, gap: 4 },
  stepTexts: { flex: 1, gap: 2 },
  h1: { fontFamily: fonts.extraBold, fontSize: 36, lineHeight: 40, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkMuted },
  h2: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    color: colors.ink,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  spacer: { height: 120 },
  spacerWide: { height: 40 },
  status: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  retry: { fontFamily: fonts.bold, fontSize: 16, color: colors.primary },
  ctaWrap: { position: 'absolute', start: 0, end: 0, alignItems: 'center' },
  cta: { height: 60, borderRadius: 30, paddingHorizontal: 28 },
  card: { borderRadius: radius.card, backgroundColor: colors.card, overflow: 'hidden' },
  cardBody: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 22, gap: 8 },
  cardTitle: { fontFamily: fonts.extraBold, fontSize: 26, color: colors.ink },
  cardText: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.inkMuted },
  steps: { borderRadius: radius.card, backgroundColor: colors.card, paddingVertical: 6 },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  stepNum: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { fontFamily: fonts.extraBold, fontSize: 19, color: colors.primary },
  stepTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  stepText: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted },
});
