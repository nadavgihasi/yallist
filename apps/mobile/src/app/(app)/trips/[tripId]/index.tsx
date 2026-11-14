import { filterItems, formatShekel, type ListFilter } from '@yallist/domain';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
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

import { AvatarStack } from '@/components/Avatar';
import { SegmentedControl } from '@/components/Controls';
import { Cover } from '@/components/Cover';
import { StateScreen } from '@/components/EmptyState';
import { FLOATING_CLEARANCE, FloatingAction } from '@/components/FloatingAction';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { Skeleton } from '@/components/Skeleton';
import { deriveTrip, toAvatar } from '@/features/trip/derive';
import { JoinedPrompt } from '@/features/trip/JoinedPrompt';
import { ListTab } from '@/features/trip/ListTab';
import { MoneyTab } from '@/features/trip/MoneyTab';
import { bringPart, moneyPart, myItems, partOf, sharedItems } from '@/features/trip/parts';
import { PeopleTab } from '@/features/trip/PeopleTab';
import { pinOffset, tabsMinHeight } from '@/features/trip/pin';
import { ReadinessHero } from '@/features/trip/ReadinessHero';
import { clearReveal, pendingReveal, revealOffset, revealTarget } from '@/features/trip/reveal';
import { RevealProvider, type ViewNode } from '@/features/trip/RevealTarget';
import { TripLinksBar } from '@/features/trip/TripLinks';
import { he, participants, peopleNames } from '@/i18n/he';
import { countdown, formatRange } from '@/lib/dates';
import { statusOf } from '@/lib/api';
import { testId } from '@/lib/testId';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { useToday } from '@/lib/useToday';
import { useMe } from '@/state/store';
import { useLeaveTrip, useTripQuery, useTripUpdates } from '@/state/trips';
import { colors, radius, size, space, type } from '@/theme';
import { contentMaxWidth, useBreakpoint } from '@/theme/breakpoint';

const TABS = ['bring', 'buy', 'money', 'people'] as const;
type Tab = (typeof TABS)[number];

/** Keeps the desktop side panel in view while the list scrolls (web only). */
const sticky = (Platform.OS === 'web' ? { position: 'sticky', top: 24 } : {}) as ViewStyle;

/**
 * Phone and tablet: once the tabs reach the top, a bar with the trip's name and the tabs stays
 * pinned there. From the safe area to the tabs: its top padding, the back button's row, the gap.
 */
const BAR_ABOVE_TABS = space[2] + size.avatar + space[3];
/** Phone and tablet: the gap between the page's blocks, a little tighter than desktop's. */
const COLUMN_GAP = space[3];
/** How long a row just added stays marked after the page scrolls to it. */
const FLASH_MS = 2400;

export default function TripScreen() {
  const params = useLocalSearchParams<{
    tripId: string;
    tab?: string;
    /** The view inside the tab (`features/trip/parts.ts`): `mine`, `settle`. */
    part?: string;
    itemId?: string;
    list?: string;
    categoryId?: string;
    /** Set by the join page: we just got in, so ask once what we'll bring. */
    joined?: string;
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
  // A tab opens on its first view unless told which.
  const setTab = (next: Tab, part?: string) => router.setParams({ tab: next, part });
  // The view inside the tab, also in the URL; each tab reads its own.
  const bringView = bringPart(params.part);
  const moneyView = moneyPart(params.part);
  const setPart = (next: string) => {
    router.setParams({ part: next });
    setFilter('all');
  };
  // Lifted from ListTab, so the hero's "missing" button can open a list already filtered.
  const [filter, setFilter] = useState<ListFilter>('all');
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  // Phone and tablet: how far down the tabs are, and whether they're pinned to the top.
  const tabsY = useRef(0);
  const [pinned, setPinned] = useState(false);
  const showPinned = !desktop && pinned;
  const pickTab = (next: Tab) => {
    setTab(next);
    setFilter('all');
    // Pinned, the new tab starts right under the pinned tabs, not where the old one was scrolled.
    if (pinned) {
      scrollRef.current?.scrollTo({
        y: pinOffset(tabsY.current, insets.top, BAR_ABOVE_TABS),
        animated: false,
      });
    }
  };
  // Phone and tablet: room under the tabs for a short tab, so switching to it while pinned
  // stays pinned instead of jumping the page back down.
  const [viewport, setViewport] = useState(0);
  const reduced = useReducedMotion();
  // Where each row is that a sheet may ask to show (`features/trip/reveal.ts`), and which flashes.
  const targets = useRef(new Map<string, ViewNode>()).current;
  const register = useCallback(
    (key: string, node: ViewNode | null) =>
      void (node ? targets.set(key, node) : targets.delete(key)),
    [targets],
  );
  const [flashing, setFlashing] = useState<string>();
  const reveals = useMemo(() => ({ register, flashing }), [register, flashing]);
  const tabsRef = useRef<ViewNode>(null);
  // Phone and tablet: the pinned bar's height, which covers the top of the page once it shows.
  const pinnedHeight = useRef(0);
  /** Scrolls to `node`, measured on the page now, so after whatever just changed above it. */
  const scrollToNode = (node: ViewNode, offset: (y: number, height: number) => number) => {
    const content = scrollRef.current?.getInnerViewNode();
    if (!content) return;
    node.measureLayout(content, (_x, y, _w, height) =>
      scrollRef.current?.scrollTo({ y: offset(y, height), animated: !reduced }),
    );
  };
  /**
   * After a button above the tabs changed what they show (a tab, a filter): bring the tabs up to
   * the top, pinned on phone and tablet, so the list it opened starts right under them.
   */
  const focusList = () =>
    requestAnimationFrame(() => {
      const node = tabsRef.current;
      if (!node) return;
      scrollToNode(node, (y) =>
        desktop ? Math.max(0, y - space[6]) : pinOffset(y, insets.top, BAR_ABOVE_TABS) + 1,
      );
    });
  // Only on top: a sheet over this screen shows its row once it closes.
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  // A sheet added something: open its tab (and a filter that shows it), then scroll to it. The
  // request comes from outside React (`requestReveal`), so it's taken here, once we're on top.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!focused || !data) return;
    const reveal = pendingReveal(tripId);
    const target = reveal && revealTarget(reveal, data);
    if (!target) return;
    clearReveal();
    const item = data.items.find((i) => i.id === target.itemId);
    // The view it shows in: my list keeps what's on it, the rest goes where it lives.
    const part =
      target.tab === 'money'
        ? 'expenses'
        : target.tab === 'bring' && item
          ? tab === 'bring' &&
            bringView === 'mine' &&
            myItems([item], data.claims, me.userId).length > 0
            ? 'mine'
            : partOf(item)
          : undefined;
    const current = tab === 'money' ? moneyView : tab === 'bring' ? bringView : undefined;
    const moved = target.tab !== tab || part !== current;
    if (moved) setTab(target.tab, part);
    if (moved || (item && filter !== 'all')) {
      const ids = deriveTrip(data, me.userId).activeIds;
      const hidden =
        item &&
        filterItems([item], filter, data.claims, data.expenses, ids, me.userId).length === 0;
      if (moved || hidden) setFilter('all');
    }
    setFlashing(target.key);
    // `tab` and `filter` are read, not watched: changing them shouldn't show the row again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, data, tripId, me.userId]);
  /* eslint-enable react-hooks/set-state-in-effect */
  // Once its row is on the page (a tab switch renders it), scroll it to the middle of the view.
  useEffect(() => {
    if (!flashing) return;
    let tries = 0;
    let frame = 0;
    const go = () => {
      const node = targets.get(flashing);
      if (!node) {
        if (tries++ < 30) frame = requestAnimationFrame(go);
        return;
      }
      scrollToNode(node, (y, height) =>
        revealOffset({
          rowY: y,
          rowHeight: height,
          viewport,
          coveredTop: desktop ? 0 : pinnedHeight.current || insets.top + BAR_ABOVE_TABS + 56,
        }),
      );
    };
    frame = requestAnimationFrame(go);
    const done = setTimeout(() => setFlashing(undefined), FLASH_MS);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashing]);
  const now = useToday();
  // Every "invite friends" button opens the invite sheet, which shows what will be sent.
  const invite = () => router.push({ pathname: '/trips/[tripId]/invite', params: { tripId } });
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
        if (view.missingIn('bring') >= view.missingIn('buy')) {
          // Only "each" items missing: they're on my list, which has no filters.
          const shared = sharedItems(view.items.filter((i) => i.list === 'bring'));
          const sharedMissing = shared.some((i) => !view.done(i));
          setTab('bring', sharedMissing ? 'shared' : 'mine');
          setFilter(sharedMissing ? 'missing' : 'all');
        } else {
          setTab('buy');
          setFilter('missing');
        }
        focusList();
      }}
      onMine={() => {
        const mineIn = (l: 'bring' | 'buy') => view.mine.filter((i) => i.list === l).length;
        if (mineIn('bring') >= mineIn('buy')) {
          // My own list is the bring list's "mine".
          setTab('bring', 'mine');
          setFilter('all');
        } else {
          setTab('buy');
          setFilter('mine');
        }
        focusList();
      }}
      onInvite={invite}
    />
  );

  const add =
    tab === 'people'
      ? null
      : tab === 'money'
        ? () => router.push({ pathname: '/trips/[tripId]/expenses/new', params: { tripId } })
        : () =>
            router.push({
              pathname: '/trips/[tripId]/items/new',
              // From my own list, a new item starts as "everyone brings their own".
              params: {
                tripId,
                list: tab,
                ...(tab === 'bring' && bringView === 'mine' && { kind: 'each' }),
              },
            });

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  // Its own id in the pinned bar, which shows while the cover's copy is still on the page.
  const backButton = (id: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={he.trip.back}
      onPress={goBack}
      style={styles.back}
      {...testId(id)}
    >
      <Icon name="back" strokeWidth={2.5} />
    </Pressable>
  );
  const back = backButton('trip-back');
  const inviteButton = (
    <PillButton
      label={he.trip.invite}
      // On the cover (phone and tablet), white like the cover's other buttons.
      variant={desktop ? 'soft' : 'card'}
      icon={<Icon name="userPlus" size={18} color={colors.primaryStrong} />}
      {...testId('trip-invite')}
      onPress={invite}
    />
  );
  const editCover = () => router.push({ pathname: '/trips/[tripId]/cover', params: { tripId } });
  const coverEdit =
    organizer &&
    (desktop ? (
      <PillButton
        label={he.cover.changeShort}
        accessibilityLabel={he.cover.change}
        variant="card"
        size="sm"
        icon={<Icon name="image" size={16} color={colors.ink} />}
        {...testId('trip-cover-edit')}
        onPress={editCover}
        style={styles.coverEdit}
      />
    ) : (
      // In the cover's row with back and invite: round like back, so all three fit at 320px.
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={he.cover.change}
        {...testId('trip-cover-edit')}
        onPress={editCover}
        style={styles.back}
      >
        <Icon name="image" size={20} color={colors.ink} />
      </Pressable>
    ));
  // Phone and tablet: a short tab still scrolls up to the pinned tabs.
  const minHeight = tabsMinHeight({
    viewport,
    insetTop: insets.top,
    insetBottom: insets.bottom,
    barAboveTabs: BAR_ABOVE_TABS,
    gapBelow: COLUMN_GAP,
    clearance: FLOATING_CLEARANCE,
  });

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        onLayout={(e) => setViewport(e.nativeEvent.layout.height)}
        // The hero scrolls away under a bar with the name and the tabs (phone and tablet).
        onScroll={
          desktop
            ? undefined
            : (e) => {
                const next =
                  tabsY.current > 0 &&
                  e.nativeEvent.contentOffset.y >=
                    pinOffset(tabsY.current, insets.top, BAR_ABOVE_TABS);
                if (next !== pinned) setPinned(next);
              }
        }
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.page,
          !desktop && styles.column,
          !desktop && styles.columnTight,
          { paddingTop: space[6] + insets.top },
        ]}
      >
        {desktop && (
          <View style={styles.topBar}>
            {back}
            {inviteButton}
          </View>
        )}
        <Cover
          scene={trip.cover}
          style={[styles.cover, desktop && styles.coverDesktop]}
          testID={`trip-hero-cover-${trip.cover}`}
          horizon
        >
          {desktop ? (
            coverEdit
          ) : (
            // Phone and tablet: back and invite on the cover, not a row of their own above it.
            <View style={styles.coverBar}>
              {back}
              <View style={styles.coverActions}>
                {coverEdit}
                {inviteButton}
              </View>
            </View>
          )}
        </Cover>
        <View style={styles.titles}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.title, styles.titleText]}
              accessibilityRole="header"
              {...testId('trip-title')}
            >
              {trip.name}
            </Text>
            {/* Who's in, beside the name: not a row of its own in the hero. */}
            {view.active.length > 1 && (
              <View
                accessible
                accessibilityLabel={peopleNames(view.active.map((m) => m.displayName))}
              >
                <AvatarStack people={view.active.map(toAvatar)} max={4} />
              </View>
            )}
          </View>
          <Text style={styles.caption}>
            {[formatRange(trip.startsOn, trip.endsOn), participants(view.activeIds.length)]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <TripLinksBar
            trip={trip}
            onMeetup={() => {
              pickTab('people');
              focusList();
            }}
          />
        </View>

        {params.joined && (
          <JoinedPrompt
            tripId={tripId}
            view={view}
            onPick={(next) => {
              setTab(next);
              setFilter('missing');
              focusList();
            }}
            onDone={() => router.setParams({ joined: undefined })}
          />
        )}
        {!desktop && hero}
        <View
          style={desktop ? styles.columns : { minHeight }}
          onLayout={(e) => (tabsY.current = e.nativeEvent.layout.y)}
        >
          <View style={[styles.main, desktop && styles.mainDesktop]}>
            <View ref={tabsRef} collapsable={false}>
              {/* Pinned, the bar's copy is the tabs: this one is out of reach of screen readers
                and the keyboard, and the test ids go with the one in view. */}
              <SegmentedControl
                options={tabs}
                value={tab}
                onChange={pickTab}
                testID={showPinned ? undefined : 'trip-tab'}
                hidden={showPinned}
              />
            </View>
            <RevealProvider value={reveals}>
              {(tab === 'bring' || tab === 'buy') && (
                <ListTab
                  key={tab}
                  list={tab}
                  part={tab === 'bring' ? bringView : undefined}
                  data={data}
                  view={view}
                  me={me.userId}
                  filter={filter}
                  onFilter={setFilter}
                  onPart={tab === 'bring' ? setPart : undefined}
                />
              )}
              {tab === 'people' && (
                <PeopleTab data={data} view={view} me={me.userId} onInvite={invite} />
              )}
              {tab === 'money' && (
                <MoneyTab
                  data={data}
                  view={view}
                  me={me.userId}
                  part={moneyView}
                  onPart={setPart}
                />
              )}
            </RevealProvider>
          </View>
          {desktop && (
            <View style={[styles.side, sticky]}>
              {hero}
              {/* Beside the expenses too: that view has no balance of its own. */}
              {view.totalSpent > 0 && (tab !== 'money' || moneyView === 'expenses') && (
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
      {showPinned && (
        <View
          style={[styles.pinned, { paddingTop: space[2] + insets.top }]}
          onLayout={(e) => (pinnedHeight.current = e.nativeEvent.layout.height)}
        >
          <View style={[styles.pinnedInner, styles.column]}>
            <View style={styles.pinnedBar}>
              {backButton('trip-pinned-back')}
              <Text style={styles.pinnedTitle} numberOfLines={1}>
                {trip.name}
              </Text>
              <Text style={styles.caption} numberOfLines={1}>
                {countdown(trip.startsOn, trip.endsOn, now).label}
              </Text>
            </View>
            <SegmentedControl options={tabs} value={tab} onChange={pickTab} testID="trip-tab" />
          </View>
        </View>
      )}
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
  // Phone and tablet: a little tighter, so the list starts higher.
  columnTight: { gap: COLUMN_GAP },
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
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Phone and tablet: a band under back and invite. Desktop: taller, under its own top bar.
  cover: { height: 80, borderRadius: radius.card },
  coverDesktop: { height: 220 },
  coverEdit: { position: 'absolute', bottom: space[3], end: space[3] },
  coverBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
    padding: space[3],
  },
  coverActions: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  titles: { gap: space[1] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  titleText: { flex: 1 },
  // Long unbroken words wrap at the column's width instead of overflowing it.
  title: { ...type.pageTitle, color: colors.ink },
  caption: { ...type.caption, color: colors.inkMuted },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: space[6] },
  main: { gap: space[4] },
  mainDesktop: { flex: 1, minWidth: 0 },
  side: { width: 340, gap: space[4] },
  sideTitle: { ...type.itemTitle, color: colors.ink },
  // Over the top of the scroll view, on the page's ground, the list scrolling under it.
  pinned: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    paddingBottom: space[3],
    backgroundColor: colors.ground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  pinnedInner: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: space.screen,
    gap: space[3],
  },
  pinnedBar: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  pinnedTitle: { ...type.itemTitle, color: colors.ink, flex: 1 },
});
