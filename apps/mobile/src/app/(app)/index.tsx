import type { TemplateId } from '@yallist/domain';
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
import { Icon } from '@/components/Icon';
import { Card } from '@/components/ListGroup';
import { TemplateTile } from '@/components/TemplateTile';
import { VersionLine } from '@/components/VersionLine';
import { PastTripRow, TripCard } from '@/features/home/TripCard';
import { ProfileButton } from '@/features/profile/ProfileButton';
import { he } from '@/i18n/he';
import { daysBetween } from '@/lib/dates';
import { useToday } from '@/lib/useToday';
import { useTrips } from '@/state/trips';
import { colors, radius, size, space, type } from '@/theme';
import { contentMaxWidth, useBreakpoint } from '@/theme/breakpoint';

/** The templates home offers as one-tap starts (the blank list stays in the new-trip picker). */
const STARTS: TemplateId[] = ['camp', 'grill', 'zimmer', 'beach'];
const SIDE_COLUMN = 340;

export default function Home() {
  const trips = useTrips();
  const now = useToday();
  const insets = useSafeAreaInsets();
  const bp = useBreakpoint();
  const wide = bp !== 'phone';
  const desktop = bp === 'desktop';
  const { width } = useWindowDimensions();
  // Measured, so a desktop scrollbar can't push the last column onto a new row.
  const [gridWidth, setGridWidth] = useState(0);
  // Wide screens: two columns of trip cards in a centered page; desktop adds a side column.
  const pad = wide ? 32 : space.screen;
  const cols = wide ? 2 : 1;
  const gap = space[4];
  const measure = (e: LayoutChangeEvent) => setGridWidth(e.nativeEvent.layout.width);
  const estimate = Math.min(width, contentMaxWidth) - 2 * pad - (desktop ? SIDE_COLUMN + gap : 0);
  const cell = { width: Math.floor(((gridWidth || estimate) - gap * (cols - 1)) / cols) };

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
          <FirstHome side={desktop} />
        ) : (
          <View style={[desktop && styles.columns, { gap }]}>
            <View style={[styles.main, { gap }]}>
              <View style={[styles.grid, { gap }]} onLayout={measure}>
                {upcoming.map((t, i) => (
                  <View key={t.trip.id} style={cell}>
                    <TripCard data={t} now={now} next={i === 0} />
                  </View>
                ))}
              </View>
              {past.length > 0 && <Text style={styles.h2}>{he.home.past}</Text>}
              <View style={[styles.grid, { gap }]}>
                {past.map((t) => (
                  <View key={t.trip.id} style={cell}>
                    <PastTripRow data={t} />
                  </View>
                ))}
              </View>
            </View>
            {/* Desktop: beside the cards. Tablet: below them. */}
            {wide && (
              <View style={[{ gap }, desktop && styles.side]}>
                <Starts title={he.home.openTrip} columns={desktop ? 1 : 2} />
                <View style={styles.callout}>
                  <Icon name="userPlus" size={20} color={colors.primaryStrong} />
                  <View style={styles.calloutTexts}>
                    <Text style={styles.calloutTitle}>{he.home.invite.title}</Text>
                    <Text style={styles.calloutText}>{he.home.invite.text}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
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

/** The illustrated card, the three steps and one-tap starts; `side` puts them side by side (desktop). */
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
      <View style={[styles.firstStack, side && styles.half]}>
        <Card gap={space[6]}>
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
        <Starts title={he.home.startFrom} columns={2} />
      </View>
    </View>
  );
}

/** Template tiles that open a new trip with that template picked. */
function Starts({ title, columns }: { title: string; columns: 1 | 2 }) {
  return (
    <View style={styles.starts}>
      <View style={styles.startsHead}>
        <Text style={styles.startsTitle}>{title}</Text>
        <Text style={styles.caption}>{he.home.oneTap}</Text>
      </View>
      <View style={styles.tiles}>
        {STARTS.map((t) => (
          <View key={t} style={columns === 2 ? styles.halfTile : styles.fullTile}>
            <TemplateTile
              template={t}
              row
              testID={`home-template-${t}`}
              onPress={() => router.push({ pathname: '/trips/new', params: { template: t } })}
            />
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
  columns: { flexDirection: 'row', alignItems: 'flex-start' },
  main: { flex: 1 },
  side: { width: SIDE_COLUMN },
  starts: { gap: space[3] },
  startsHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[2],
    flexWrap: 'wrap',
  },
  startsTitle: { ...type.itemTitle, color: colors.ink },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  // Two equal columns at any width; a lone last tile would stretch, but there are four.
  halfTile: { flexBasis: '40%', flexGrow: 1 },
  fullTile: { width: '100%' },
  callout: {
    flexDirection: 'row',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.card,
    backgroundColor: colors.primaryTint,
  },
  calloutTexts: { flex: 1, gap: space[1] },
  calloutTitle: { ...type.buttonSm, color: colors.primaryStrong },
  calloutText: { ...type.caption, color: colors.primaryStrong },
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
