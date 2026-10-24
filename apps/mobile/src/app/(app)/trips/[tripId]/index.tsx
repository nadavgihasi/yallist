import { formatShekel } from '@yallist/domain';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Cover } from '@/components/Cover';
import { Fab, GlassTabBar, glassStyle, type TabSpec } from '@/components/GlassTabBar';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { TabRow } from '@/components/TabRow';
import { deriveTrip } from '@/features/trip/derive';
import { ListTab } from '@/features/trip/ListTab';
import { MoneyTab } from '@/features/trip/MoneyTab';
import { PeopleTab } from '@/features/trip/PeopleTab';
import { StatusCard } from '@/features/trip/StatusCard';
import { he } from '@/i18n/he';
import { formatRange } from '@/lib/dates';
import { statusOf } from '@/lib/api';
import { useMe } from '@/state/store';
import { useTripQuery } from '@/state/trips';
import { colors, fonts, radius } from '@/theme';
import { contentMaxWidth, useBreakpoint } from '@/theme/breakpoint';

const TABS = ['bring', 'buy', 'people', 'money'] as const;
type Tab = (typeof TABS)[number];

/** Keeps the desktop side panel in view while the list scrolls (web only). */
const sticky = (Platform.OS === 'web' ? { position: 'sticky', top: 24 } : {}) as ViewStyle;

export default function TripScreen() {
  const params = useLocalSearchParams<{
    tripId: string;
    tab?: string;
    itemId?: string;
    list?: string;
    categoryId?: string;
  }>();
  const { tripId, itemId, list, categoryId } = params;
  const query = useTripQuery(tripId);
  const data = query.data;
  const me = useMe();
  const insets = useSafeAreaInsets();
  const bp = useBreakpoint();
  // Tablet and desktop: cover as a header band, tabs on top, inline add button instead of the FAB.
  const wide = bp !== 'phone';
  const desktop = bp === 'desktop';
  // The cover spans the window; its contents line up with the centered page column.
  const { width } = useWindowDimensions();
  const coverInset = { marginHorizontal: Math.max(0, (width - contentMaxWidth) / 2) };
  // The tab lives in the URL (`?tab=buy`) so reload and Back keep it.
  const tab: Tab = TABS.find((t) => t === params.tab) ?? 'bring';
  const setTab = (next: Tab) => router.setParams({ tab: next });
  // A sheet opened by URL hands its params to this screen underneath it. Clear them once this
  // screen is focused again: `router.setParams` targets the focused route, not necessarily this one.
  useFocusEffect(
    useCallback(() => {
      if (itemId || list || categoryId) {
        router.setParams({ itemId: undefined, list: undefined, categoryId: undefined });
      }
    }, [itemId, list, categoryId]),
  );

  if (!data) {
    if (query.isPending) {
      return <ActivityIndicator color={colors.accent} style={styles.missing} />;
    }
    // Not a member (or no such trip) is a 4xx; anything else may pass.
    const gone = (statusOf(query.error) ?? 500) < 500;
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>{gone ? he.trip.notFound : he.errors.loadFailed}</Text>
        {!gone && (
          <Pressable onPress={() => query.refetch()}>
            <Text style={styles.link}>{he.errors.retry}</Text>
          </Pressable>
        )}
        <Pressable onPress={() => router.replace('/')}>
          <Text style={styles.link}>{he.trip.back}</Text>
        </Pressable>
      </View>
    );
  }

  const view = deriveTrip(data, me.userId);
  const { trip } = data;
  // Beach sand is light: title on a dark panel (SPEC). Blank is pale all over: ink text instead.
  const onPanel = trip.template === 'beach';
  const inkText = trip.template === 'blank' && { color: colors.ink };
  // Long names get a smaller size; two lines at most, and long words break inside the cover.
  const titleSize = trip.name.length > 18 ? styles.titleLong : undefined;

  const tabs: TabSpec<Tab>[] = [
    { value: 'bring', label: he.trip.tabs.bring, icon: 'bring', badge: view.missingIn('bring') },
    { value: 'buy', label: he.trip.tabs.buy, icon: 'buy', badge: view.missingIn('buy') },
    { value: 'people', label: he.trip.tabs.people, icon: 'users' },
    { value: 'money', label: he.trip.tabs.money, icon: 'wallet' },
  ];

  const fab =
    tab === 'people'
      ? null
      : tab === 'money'
        ? () => router.push({ pathname: '/trips/[tripId]/expenses/new', params: { tripId } })
        : () =>
            router.push({ pathname: '/trips/[tripId]/items/new', params: { tripId, list: tab } });

  return (
    <View style={styles.screen}>
      <ScrollView>
        <Cover scene={trip.template} style={{ height: (wide ? 280 : 300) + insets.top }}>
          <View style={[styles.topBar, coverInset, { top: (wide ? 20 : 12) + insets.top }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={he.trip.back}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              style={[styles.roundButton, glassStyle]}
            >
              <Icon name="back" />
            </Pressable>
          </View>
          <View style={[styles.titleBlock, coverInset, onPanel && styles.titlePanel]}>
            <View style={styles.dateChip}>
              <Text style={styles.dateText}>{formatRange(trip.startsOn, trip.endsOn)}</Text>
            </View>
            <Text
              style={[styles.title, titleSize, inkText]}
              numberOfLines={2}
              adjustsFontSizeToFit
              accessibilityRole="header"
            >
              {trip.name}
            </Text>
            {trip.placeText && (
              <Text style={[styles.place, inkText]} numberOfLines={1}>
                {trip.placeText}
              </Text>
            )}
          </View>
        </Cover>
        <View style={wide && styles.page}>
          {!desktop && (
            <StatusCard
              view={view}
              members={view.active}
              me={me.userId}
              style={wide && styles.statusWide}
            />
          )}
          {wide && (
            <View style={styles.tabRow}>
              <TabRow
                tabs={tabs}
                value={tab}
                onChange={setTab}
                end={
                  fab && (
                    <PillButton
                      label={he.trip.fab[tab as 'bring' | 'buy' | 'money']}
                      icon={<Icon name="plus" color={colors.white} size={20} />}
                      onPress={fab}
                    />
                  )
                }
              />
            </View>
          )}
          <View style={desktop && styles.columns}>
            <View style={desktop && styles.main}>
              {(tab === 'bring' || tab === 'buy') && (
                <ListTab key={tab} list={tab} data={data} view={view} me={me.userId} />
              )}
              {tab === 'people' && <PeopleTab data={data} view={view} me={me.userId} />}
              {tab === 'money' && <MoneyTab data={data} view={view} me={me.userId} />}
            </View>
            {desktop && (
              <View style={[styles.side, sticky]}>
                <StatusCard
                  view={view}
                  members={view.active}
                  me={me.userId}
                  style={styles.statusSide}
                />
                {view.totalSpent > 0 && tab !== 'money' && (
                  <View style={styles.sideCard}>
                    <Text style={styles.sideTitle}>{he.trip.tabs.money}</Text>
                    <Text style={styles.sideText}>
                      {he.money.share(formatShekel(view.myShare), formatShekel(view.totalSpent))}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
        <View style={{ height: (wide ? 48 : 120) + insets.bottom }} />
      </ScrollView>
      {!wide && <GlassTabBar value={tab} onChange={setTab} tabs={tabs} />}
      {!wide && fab && (
        <Fab
          label={he.trip.fab[tab as 'bring' | 'buy' | 'money']}
          icon={<Icon name="plus" color={colors.white} size={28} />}
          onPress={fab}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  missingText: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  link: { fontFamily: fonts.semibold, fontSize: 16, color: colors.accent },
  page: { width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center', paddingHorizontal: 16 },
  statusWide: { marginHorizontal: 16 },
  tabRow: { paddingHorizontal: 16, paddingTop: 24 },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  main: { flex: 1, minWidth: 0 },
  side: { width: 380, paddingTop: 20, paddingEnd: 16, gap: 16 },
  statusSide: { marginTop: 0, marginHorizontal: 0 },
  sideCard: { padding: 20, borderRadius: radius.card, backgroundColor: colors.surface, gap: 4 },
  sideTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  sideText: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkSecondary },
  topBar: { position: 'absolute', start: 16, end: 16, flexDirection: 'row' },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    position: 'absolute',
    start: 20,
    end: 20,
    bottom: 44,
    gap: 8,
    alignItems: 'flex-start',
  },
  titlePanel: {
    start: 14,
    end: 14,
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(14,23,38,0.45)',
  },
  dateChip: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: colors.darkGlass,
    justifyContent: 'center',
  },
  dateText: { fontFamily: fonts.medium, fontSize: 13, color: colors.white },
  // Stretch so a long unbroken word wraps at the cover's width instead of overflowing it.
  title: {
    alignSelf: 'stretch',
    fontFamily: fonts.displayBold,
    fontSize: 42,
    lineHeight: 44,
    color: colors.white,
  },
  titleLong: { fontSize: 32, lineHeight: 36 },
  place: { fontFamily: fonts.medium, fontSize: 15, color: colors.white, opacity: 0.9 },
});
