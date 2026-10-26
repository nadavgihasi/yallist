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

import { Cover } from '@/components/Cover';
import { FLOATING_CLEARANCE, FloatingAction } from '@/components/FloatingAction';
import { Card } from '@/components/ListGroup';
import { VersionLine } from '@/components/VersionLine';
import { PastTripRow, TripCard } from '@/features/home/TripCard';
import { ProfileButton } from '@/features/profile/ProfileButton';
import { he } from '@/i18n/he';
import { daysBetween } from '@/lib/dates';
import { useToday } from '@/lib/useToday';
import { useTrips } from '@/state/trips';
import { colors, radius, size, space, type } from '@/theme';
import { contentMaxWidth, useBreakpoint } from '@/theme/breakpoint';

export default function Home() {
  const trips = useTrips();
  const now = useToday();
  const insets = useSafeAreaInsets();
  const bp = useBreakpoint();
  const wide = bp !== 'phone';
  const { width } = useWindowDimensions();
  // Measured, so a desktop scrollbar can't push the last column onto a new row.
  const [gridWidth, setGridWidth] = useState(0);
  // Wide screens: trip cards in a grid inside a centered column.
  const pad = wide ? 32 : space.screen;
  const cols = bp === 'desktop' ? 3 : bp === 'tablet' ? 2 : 1;
  const gap = space[4];
  const measure = (e: LayoutChangeEvent) => setGridWidth(e.nativeEvent.layout.width);
  const cell = {
    width: Math.floor(
      ((gridWidth || Math.min(width, contentMaxWidth) - 2 * pad) - gap * (cols - 1)) / cols,
    ),
  };

  // The API sorts them by start date.
  const all = trips.data?.trips ?? [];
  const upcoming = all.filter((t) => daysBetween(now, t.trip.endsOn) >= 0);
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
          <Text style={styles.h1} accessibilityRole="header">
            {he.home.title}
          </Text>
          <ProfileButton />
        </View>

        {trips.isPending ? (
          <ActivityIndicator color={colors.primary} style={styles.status} />
        ) : trips.isError && !trips.data ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => trips.refetch()}
            style={styles.status}
          >
            <Text style={styles.caption}>{he.errors.loadFailed}</Text>
            <Text style={styles.retry}>{he.errors.retry}</Text>
          </Pressable>
        ) : empty ? (
          <FirstHome side={bp === 'desktop'} />
        ) : (
          <>
            <View style={[styles.grid, { gap }]} onLayout={measure}>
              {upcoming.map((t) => (
                <View key={t.trip.id} style={cell}>
                  <TripCard data={t} now={now} />
                </View>
              ))}
            </View>
            {past.length > 0 && <Text style={styles.h2}>{he.home.past}</Text>}
            <View style={[styles.grid, { gap }]} onLayout={measure}>
              {past.map((t) => (
                <View key={t.trip.id} style={cell}>
                  <PastTripRow data={t} />
                </View>
              ))}
            </View>
          </>
        )}
        <VersionLine />
        <View style={{ height: FLOATING_CLEARANCE }} />
      </ScrollView>
      <FloatingAction
        label={empty ? he.firstHome.cta : he.home.newTrip}
        testID="home-new-trip"
        onPress={() => router.push('/trips/new')}
      />
    </View>
  );
}

/** The illustrated card and the three steps; `side` puts them side by side (desktop). */
function FirstHome({ side }: { side: boolean }) {
  return (
    <View style={side ? styles.firstSide : styles.firstStack}>
      <View style={[styles.illustrated, side && styles.half]}>
        <Cover scene="camp" style={styles.illustration} />
        <View style={styles.illustratedBody}>
          <Text style={styles.cardTitle}>{he.firstHome.emptyTitle}</Text>
          <Text style={styles.body}>{he.firstHome.emptyText}</Text>
        </View>
      </View>
      <Card gap={space[6]} style={side && styles.half}>
        {he.firstHome.steps.map(([title, text], i) => (
          <View key={title} style={styles.step}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <View style={styles.stepTexts}>
              <Text style={styles.stepTitle}>{title}</Text>
              <Text style={styles.caption}>{text}</Text>
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: { width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  firstStack: { gap: space[4] },
  firstSide: { flexDirection: 'row', gap: space[4], alignItems: 'flex-start' },
  half: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[4],
  },
  h1: { ...type.pageTitle, color: colors.ink, flexShrink: 1 },
  h2: {
    ...type.caption,
    fontFamily: type.itemTitle.fontFamily,
    color: colors.inkMuted,
    marginTop: space[2],
  },
  caption: { ...type.caption, color: colors.inkMuted },
  body: { ...type.body, color: colors.inkMuted },
  status: { alignItems: 'center', gap: space[2], paddingVertical: 48 },
  retry: { ...type.buttonSm, color: colors.primary },
  illustrated: { borderRadius: radius.card, backgroundColor: colors.card, overflow: 'hidden' },
  // Tall enough that the `slice` crop keeps the tent in view at any card width.
  illustration: { aspectRatio: 390 / 240 },
  illustratedBody: { padding: space[5], gap: space[3] },
  cardTitle: { ...type.sectionTitle, color: colors.ink },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepNum: {
    width: size.step,
    height: size.step,
    borderRadius: size.step / 2,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { ...type.stepNumber, color: colors.primary },
  stepTexts: { flex: 1, gap: space[1] },
  stepTitle: { ...type.itemTitle, color: colors.ink },
});
