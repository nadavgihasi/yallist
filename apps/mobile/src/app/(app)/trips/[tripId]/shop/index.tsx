import { runSummary, type Item } from '@yallist/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { FLOATING_CLEARANCE, FloatingAction } from '@/components/FloatingAction';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/ListGroup';
import { Loader } from '@/components/Loader';
import { PillButton } from '@/components/PillButton';
import { Progress } from '@/components/Progress';
import { deriveTrip, type TripView } from '@/features/trip/derive';
import { buyQuantity } from '@/features/trip/labels';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useMe } from '@/state/store';
import { useFinishWaiting, useTripAction, useTripQuery, useTripUpdates } from '@/state/trips';
import type { TripData } from '@/state/types';
import { avatarSize, colors, radius, size, space, type } from '@/theme';

/** How many items others added during the run show at once. */
const LIVE_ADDITIONS = 3;

const toTrip = (tripId: string) =>
  router.dismissTo({ pathname: '/trips/[tripId]', params: { tripId, tab: 'buy' } });

/**
 * In the store (PACKING_SHOPPING_SPEC §6.6): my open run's items, checked off into the cart.
 * Works offline from the cached trip; check-offs queue like any other change.
 */
export default function ShopRun() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const query = useTripQuery(tripId);
  // Live: items others add or delete while I'm in the store.
  useTripUpdates(tripId, query.isSuccess);
  const me = useMe().userId;
  const data = query.data;
  const view = data && deriveTrip(data, me);
  const over = !!data && !view?.myRun;
  // No open run (finished, cancelled, or never started): back to the buy list. A finish waiting
  // to sync keeps the run, so this screen stays until it has.
  useEffect(() => {
    if (over) toTrip(tripId);
  }, [over, tripId]);
  if (!data || !view?.myRun) return <Loader line={he.states.loading} />;
  return <ShopRunBody data={data} view={view} runId={view.myRun.id} me={me} />;
}

function ShopRunBody({
  data,
  view,
  runId,
  me,
}: {
  data: TripData;
  view: TripView;
  runId: string;
  me: string;
}) {
  const tripId = data.trip.id;
  const act = useTripAction(tripId);
  const insets = useSafeAreaInsets();
  const waiting = useFinishWaiting(tripId);
  const [menu, setMenu] = useState<'closed' | 'open' | 'confirm'>('closed');
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());

  const { inCart, notInCart } = runSummary(view.runClaims(runId), view.items);
  const rows = [...inCart, ...notInCart].sort((a, b) => a.position - b.position);
  const cart = new Set(inCart.map((i) => i.id));
  // Free items others added since the run started, newest first.
  const startedAt = view.myRun!.startedAt;
  const added = view.runEligible
    .filter((i) => i.createdBy !== me && i.createdAt && i.createdAt > startedAt)
    .filter((i) => !dismissed.has(i.id))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, LIVE_ADDITIONS);

  const toggle = (item: Item) =>
    act({ type: 'setInCart', itemId: item.id, inCart: !cart.has(item.id) });
  // The run disappears at once, and with it this screen.
  const cancel = () => act({ type: 'cancelRun', runId });

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.page, { paddingTop: space[6] + insets.top }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.titles}>
            <Text style={styles.title} accessibilityRole="header" {...testId('shop-title')}>
              {he.shop.title}
            </Text>
            <Text style={styles.caption}>{he.shop.subtitle(data.trip.name)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={he.shop.menu}
            accessibilityState={{ expanded: menu !== 'closed' }}
            onPress={() => setMenu(menu === 'closed' ? 'open' : 'closed')}
            style={styles.round}
            {...testId('shop-menu')}
          >
            <Icon name="more" strokeWidth={3} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={he.shop.back}
            onPress={() => toTrip(tripId)}
            style={styles.round}
          >
            <Icon name="back" strokeWidth={2.5} />
          </Pressable>
        </View>

        {menu !== 'closed' && (
          <Card gap={space[2]}>
            {menu === 'confirm' && <Text style={styles.body}>{he.shop.cancelConfirm}</Text>}
            <View style={styles.menuRow}>
              <PillButton
                label={menu === 'confirm' ? he.shop.cancelYes : he.shop.cancel}
                variant="danger"
                onPress={() => (menu === 'confirm' ? cancel() : setMenu('confirm'))}
                {...testId('shop-cancel')}
              />
              {menu === 'confirm' && (
                <PillButton
                  label={he.shop.keep}
                  variant="quiet"
                  onPress={() => setMenu('closed')}
                />
              )}
            </View>
          </Card>
        )}

        <View style={styles.pill}>
          <View style={styles.dot} />
          <Text style={styles.caption}>
            {waiting ? `${he.shop.everyoneSees} · ${he.shop.waiting}` : he.shop.everyoneSees}
          </Text>
        </View>

        <Card gap={space[1]}>
          <Text style={styles.cartCount} accessibilityLiveRegion="polite">
            {he.shop.inCart(inCart.length, rows.length)}
          </Text>
          <View style={styles.bar}>
            <Progress done={inCart.length} total={rows.length} />
          </View>
          {rows.map((item) => {
            const on = cart.has(item.id);
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={on ? he.shop.fromCart(item.name) : he.shop.toCart(item.name)}
                onPress={() => toggle(item)}
                style={styles.row}
                {...testId(`shop-item-${item.name}`)}
              >
                {on ? (
                  <View style={[styles.check, styles.checkOn]}>
                    <Icon name="check" size={18} color={colors.onPrimary} strokeWidth={3} />
                  </View>
                ) : (
                  <View style={styles.check} />
                )}
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.caption}>{buyQuantity(item)}</Text>
              </Pressable>
            );
          })}
        </Card>

        {added.map((item) => (
          <Card key={item.id} style={styles.added}>
            <Avatar person={view.avatarOf(item.createdBy ?? '')} size={avatarSize.md} />
            <View style={styles.titles}>
              <Text style={styles.caption}>
                {he.shop.addedBy(view.displayNameOf(item.createdBy ?? ''))}
              </Text>
              <Text style={styles.name}>
                {[item.name, buyQuantity(item)].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <PillButton
              label={he.shop.alsoMine}
              variant="soft"
              onPress={() => act({ type: 'addToRun', runId, itemId: item.id })}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={he.shop.dismiss}
              onPress={() => setDismissed(new Set(dismissed).add(item.id))}
              style={styles.dismiss}
            >
              <Icon name="close" size={18} color={colors.inkMuted} />
            </Pressable>
          </Card>
        ))}
        <View style={{ height: FLOATING_CLEARANCE + insets.bottom }} />
      </ScrollView>
      <FloatingAction
        label={he.shop.checkout}
        icon="check"
        testID="shop-checkout"
        onPress={() => router.push({ pathname: '/trips/[tripId]/shop/finish', params: { tripId } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  page: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: space.screen,
    gap: space[4],
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  titles: { flex: 1, gap: space[1] },
  title: { ...type.pageTitle, color: colors.ink },
  caption: { ...type.caption, color: colors.inkMuted },
  body: { ...type.body, color: colors.ink },
  round: {
    width: size.avatar,
    height: size.avatar,
    borderRadius: size.avatar / 2,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    alignSelf: 'flex-start',
    paddingVertical: space[2],
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  cartCount: { ...type.itemTitle, color: colors.ink },
  bar: { marginTop: 6, marginBottom: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 52 },
  check: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.inkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  name: { ...type.itemTitle, fontSize: 17, lineHeight: 24, color: colors.ink, flex: 1 },
  added: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  dismiss: {
    width: space.touch,
    height: space.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
