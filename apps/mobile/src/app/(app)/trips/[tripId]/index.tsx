import { formatShekel, type ListFilter } from '@yallist/domain';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SegmentedControl } from '@/components/Controls';
import { Cover } from '@/components/Cover';
import { StateScreen } from '@/components/EmptyState';
import { FLOATING_CLEARANCE, FloatingAction } from '@/components/FloatingAction';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { Skeleton } from '@/components/Skeleton';
import { deriveTrip } from '@/features/trip/derive';
import { ListTab } from '@/features/trip/ListTab';
import { MoneyTab } from '@/features/trip/MoneyTab';
import { PeopleTab } from '@/features/trip/PeopleTab';
import { ReadinessHero } from '@/features/trip/ReadinessHero';
import { TripLinks } from '@/features/trip/TripLinks';
import { he, participants } from '@/i18n/he';
import { formatRange } from '@/lib/dates';
import { statusOf } from '@/lib/api';
import { testId } from '@/lib/testId';
import { useToday } from '@/lib/useToday';
import { useMe } from '@/state/store';
import { useLeaveTrip, useTripQuery, useTripUpdates } from '@/state/trips';
import { colors, radius, size, space, type } from '@/theme';
import { contentMaxWidth, useBreakpoint } from '@/theme/breakpoint';

const TABS = ['bring', 'buy', 'money', 'people'] as const;
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
  useTripUpdates(tripId, query.isSuccess);
  const data = query.data;
  const me = useMe();
  const insets = useSafeAreaInsets();
  const bp = useBreakpoint();
  // Desktop: who's in and the money summary in a side panel beside the list.
  const desktop = bp === 'desktop';
  // The tab lives in the URL (`?tab=buy`) so reload and Back keep it.
  const tab: Tab = TABS.find((t) => t === params.tab) ?? 'bring';
  const setTab = (next: Tab) => router.setParams({ tab: next });
  // Lifted from ListTab, so the hero's "missing" button can open a list already filtered.
  const [filter, setFilter] = useState<ListFilter>('all');
  const pickTab = (next: Tab) => {
    setTab(next);
    setFilter('all');
  };
  const now = useToday();
  // A sheet opened by URL hands its params to this screen underneath it. Clear them once this
  // screen is focused again: `router.setParams` targets the focused route, not necessarily this one.
  useFocusEffect(
    useCallback(() => {
      if (itemId || list || categoryId) {
        router.setParams({ itemId: undefined, list: undefined, categoryId: undefined });
      }
    }, [itemId, list, categoryId]),
  );

  // Open when it was deleted (its realtime event refetches it) or we were removed from it: home,
  // with a word on why, rather than a trip that no longer saves anything.
  const leave = useLeaveTrip(tripId);
  const gone = data !== undefined && statusOf(query.error) === 404;
  useEffect(() => {
    if (gone) leave(he.deleteTrip.gone);
  }, [gone, leave]);

  const home = { label: he.states.toTrips, onPress: () => router.replace('/') };
  if (!data) {
    if (query.isPending) return <TripSkeleton top={space[6] + insets.top} />;
    // Not a member (or no such trip) is a 4xx; anything else may pass.
    return (statusOf(query.error) ?? 500) < 500 ? (
      <StateScreen spot="signpost" {...he.states.notFound} actions={[home]} />
    ) : (
      <StateScreen
        spot="noSignal"
        {...he.states.offline}
        actions={[{ label: he.errors.retry, onPress: () => void query.refetch() }, home]}
      />
    );
  }

  const view = deriveTrip(data, me.userId);
  const { trip } = data;
  const organizer = view.memberById.get(me.userId)?.role === 'organizer';
  const count = (l: 'bring' | 'buy') => view.items.filter((i) => i.list === l).length;
  const tabs = [
    { value: 'bring' as const, label: he.trip.tabCount(he.trip.tabs.bring, count('bring')) },
    { value: 'buy' as const, label: he.trip.tabCount(he.trip.tabs.buy, count('buy')) },
    { value: 'money' as const, label: he.trip.tabs.money },
    { value: 'people' as const, label: he.trip.tabs.people },
  ];

  // Phone and tablet: above the tabs. Desktop: at the top of the side panel.
  const hero = (
    <ReadinessHero
      data={data}
      view={view}
      me={me.userId}
      now={now}
      onMissing={() => {
        setTab(view.missingIn('bring') >= view.missingIn('buy') ? 'bring' : 'buy');
        setFilter('missing');
      }}
      onInvite={() => pickTab('people')}
    />
  );

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
            onPress={() => pickTab('people')}
          />
        </View>
        <Cover
          scene={trip.cover}
          style={[styles.cover, desktop && styles.coverDesktop]}
          testID={`trip-hero-cover-${trip.cover}`}
        >
          {organizer && (
            <PillButton
              label={he.cover.changeShort}
              accessibilityLabel={he.cover.change}
              variant="card"
              size="sm"
              icon={<Icon name="image" size={16} color={colors.ink} />}
              {...testId('trip-cover-edit')}
              onPress={() => router.push({ pathname: '/trips/[tripId]/cover', params: { tripId } })}
              style={styles.coverEdit}
            />
          )}
        </Cover>
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
        <TripLinks trip={trip} organizer={organizer} />

        {!desktop && hero}
        <View style={desktop && styles.columns}>
          <View style={[styles.main, desktop && styles.mainDesktop]}>
            <SegmentedControl options={tabs} value={tab} onChange={pickTab} testID="trip-tab" />
            {(tab === 'bring' || tab === 'buy') && (
              <ListTab
                key={tab}
                list={tab}
                data={data}
                view={view}
                me={me.userId}
                filter={filter}
                onFilter={setFilter}
              />
            )}
            {tab === 'people' && <PeopleTab data={data} view={view} me={me.userId} />}
            {tab === 'money' && <MoneyTab data={data} view={view} me={me.userId} />}
          </View>
          {desktop && (
            <View style={[styles.side, sticky]}>
              {hero}
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

/** The trip while it loads: cover and title, the hero, then a list. */
function TripSkeleton({ top }: { top: number }) {
  return (
    <View style={styles.screen}>
      <Skeleton style={[styles.page, styles.column, { paddingTop: top }]}>
        <Skeleton.Card cover={120}>
          <Skeleton.Line width="60%" height={28} />
          <Skeleton.Line width="40%" />
        </Skeleton.Card>
        <Skeleton.Card>
          <View style={styles.skeletonRow}>
            <View style={styles.skeletonLines}>
              <Skeleton.Line width="45%" height={24} />
              <Skeleton.Line width="70%" />
            </View>
            <Skeleton.Circle size={size.ring.hero} />
          </View>
        </Skeleton.Card>
        <Skeleton.Card>
          {[70, 50, 60].map((w) => (
            <View key={w} style={styles.skeletonRow}>
              <Skeleton.Circle size={size.ring.status} />
              <Skeleton.Line width={`${w}%`} />
            </View>
          ))}
        </Skeleton.Card>
      </Skeleton>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  skeletonLines: { flex: 1, gap: space[3] },
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
  cover: { height: 120, borderRadius: radius.card },
  coverDesktop: { height: 220 },
  coverEdit: { position: 'absolute', bottom: space[3], end: space[3] },
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
