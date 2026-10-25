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
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarStack } from '@/components/Avatar';
import { SegmentedControl } from '@/components/Controls';
import { FLOATING_CLEARANCE, FloatingAction } from '@/components/FloatingAction';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { toAvatar, deriveTrip } from '@/features/trip/derive';
import { ListTab } from '@/features/trip/ListTab';
import { MoneyTab } from '@/features/trip/MoneyTab';
import { PeopleTab } from '@/features/trip/PeopleTab';
import { he, participants } from '@/i18n/he';
import { formatRange } from '@/lib/dates';
import { statusOf } from '@/lib/api';
import { testId } from '@/lib/testId';
import { useMe } from '@/state/store';
import { useTripQuery } from '@/state/trips';
import { colors, size, space, type } from '@/theme';
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
  // Desktop: who's in and the money summary in a side panel beside the list.
  const desktop = bp === 'desktop';
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
      return <ActivityIndicator color={colors.primary} style={styles.missing} />;
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
  const count = (l: 'bring' | 'buy') => view.items.filter((i) => i.list === l).length;
  const tabs = [
    { value: 'bring' as const, label: he.trip.tabCount(he.trip.tabs.bring, count('bring')) },
    { value: 'buy' as const, label: he.trip.tabCount(he.trip.tabs.buy, count('buy')) },
    { value: 'people' as const, label: he.trip.tabs.people },
    { value: 'money' as const, label: he.trip.tabs.money },
  ];

  const add =
    tab === 'people'
      ? null
      : tab === 'money'
        ? () => router.push({ pathname: '/trips/[tripId]/expenses/new', params: { tripId } })
        : () =>
            router.push({ pathname: '/trips/[tripId]/items/new', params: { tripId, list: tab } });

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.page,
          !desktop && styles.column,
          { paddingTop: space[6] + insets.top },
        ]}
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={he.trip.back}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={styles.back}
          >
            <Icon name="back" strokeWidth={2.5} />
          </Pressable>
          <PillButton
            label={he.trip.invite}
            variant="soft"
            icon={<Icon name="userPlus" size={18} color={colors.primaryStrong} />}
            onPress={() => setTab('people')}
          />
        </View>
        <View style={styles.titles}>
          <Text style={styles.title} accessibilityRole="header" {...testId('trip-title')}>
            {trip.name}
          </Text>
          <Text style={styles.caption}>
            {[
              formatRange(trip.startsOn, trip.endsOn),
              trip.placeText,
              participants(view.activeIds.length),
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>

        <View style={desktop && styles.columns}>
          <View style={[styles.main, desktop && styles.mainDesktop]}>
            <SegmentedControl options={tabs} value={tab} onChange={setTab} testID="trip-tab" />
            {(tab === 'bring' || tab === 'buy') && (
              <ListTab key={tab} list={tab} data={data} view={view} me={me.userId} />
            )}
            {tab === 'people' && <PeopleTab data={data} view={view} me={me.userId} />}
            {tab === 'money' && <MoneyTab data={data} view={view} me={me.userId} />}
          </View>
          {desktop && (
            <View style={[styles.side, sticky]}>
              <Card gap={space[3]}>
                <Text style={styles.sideTitle}>{participants(view.activeIds.length)}</Text>
                <AvatarStack people={view.active.map(toAvatar)} max={8} />
              </Card>
              {view.totalSpent > 0 && tab !== 'money' && (
                <Card gap={space[1]}>
                  <Text style={styles.sideTitle}>{he.trip.tabs.money}</Text>
                  <Text style={styles.caption}>
                    {he.money.share(formatShekel(view.myShare), formatShekel(view.totalSpent))}
                  </Text>
                </Card>
              )}
            </View>
          )}
        </View>
        <View style={{ height: FLOATING_CLEARANCE + insets.bottom }} />
      </ScrollView>
      {add && (
        <FloatingAction
          label={he.trip.fabShort[tab as 'bring' | 'buy' | 'money']}
          accessibilityLabel={he.trip.fab[tab as 'bring' | 'buy' | 'money']}
          testID="trip-add"
          onPress={add}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[3] },
  missingText: { ...type.sectionTitle, color: colors.ink },
  link: { ...type.buttonSm, color: colors.primary },
  page: {
    width: '100%',
    maxWidth: contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: space.screen,
    gap: space[4],
  },
  // Phone and tablet: one column, capped so rows don't stretch across a tablet.
  column: { maxWidth: 640 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[4],
  },
  back: {
    width: size.avatar,
    height: size.avatar,
    borderRadius: size.avatar / 2,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { gap: space[1] },
  // Long unbroken words wrap at the column's width instead of overflowing it.
  title: { ...type.pageTitle, color: colors.ink },
  caption: { ...type.caption, color: colors.inkMuted },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: space[6] },
  main: { gap: space[4] },
  mainDesktop: { flex: 1, minWidth: 0 },
  side: { width: 340, gap: space[4] },
  sideTitle: { ...type.itemTitle, color: colors.ink },
});
