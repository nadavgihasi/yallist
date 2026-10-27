import { claimsFor } from '@yallist/domain';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { showToast } from '@/components/Toast';
import { useCloseSheet } from '@/features/trip/closeSheet';
import { deriveTrip } from '@/features/trip/derive';
import { buyQuantity } from '@/features/trip/labels';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useMe } from '@/state/store';
import { useTrip, useTripAction, type StartedRun } from '@/state/trips';
import type { TripData } from '@/state/types';
import { avatarSize, colors, space, type } from '@/theme';

/** Going shopping (PACKING_SHOPPING_SPEC §6.5): pick the free buy items to take on. */
export default function StartRun() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const data = useTrip(tripId);
  if (!data) return null;
  return <StartRunBody data={data} />;
}

function StartRunBody({ data }: { data: TripData }) {
  const me = useMe().userId;
  const tripId = data.trip.id;
  const act = useTripAction(tripId);
  const close = useCloseSheet(tripId);
  const view = deriveTrip(data, me);
  const free = view.runEligible;
  // Every free item starts selected; ones that stop being free drop out.
  const [unpicked, setUnpicked] = useState<ReadonlySet<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const picked = free.filter((i) => !unpicked.has(i.id));
  const allPicked = picked.length === free.length;
  // Someone else took them and hasn't bought them yet.
  const taken = view.items.flatMap((item) => {
    if (item.list !== 'buy' || item.kind === 'each' || view.status(item).kind === 'bought') {
      return [];
    }
    const holder = claimsFor(item.id, data.claims).find((c) => c.userId !== me);
    return holder ? [{ item, holder: holder.userId }] : [];
  });

  const toggle = (id: string) =>
    setUnpicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const start = () => {
    if (picked.length === 0 || starting) return;
    setStarting(true);
    // Needs the API's answer (the run, and what someone else got first), so the store screen
    // opens once it comes.
    act(
      { type: 'startRun', itemIds: picked.map((i) => i.id) },
      {
        onSuccess: (result) => {
          const { skipped } = result as StartedRun;
          const names = skipped.flatMap(({ itemId, claimedBy }) => {
            const item = data.items.find((i) => i.id === itemId);
            return item && claimedBy ? [he.shop.skipped(item.name, view.nameOf(claimedBy))] : [];
          });
          if (names.length > 0) showToast(names.join(' · '));
          router.replace({ pathname: '/trips/[tripId]/shop', params: { tripId } });
        },
        onError: () => setStarting(false),
      },
    );
  };

  return (
    <Sheet
      title={he.shop.start}
      subtitle={he.shop.startCaption}
      onClose={close}
      gap={space[3]}
      footer={
        <PillButton
          label={picked.length === 0 ? he.shop.pickOne : he.shop.claim(picked.length)}
          size="lg"
          wide
          disabled={picked.length === 0 || starting}
          icon={<Icon name="cart" color={colors.onPrimary} />}
          onPress={start}
          {...testId('shop-start-save')}
        />
      }
    >
      <View style={styles.head}>
        <Text style={styles.caption}>{he.shop.picked(picked.length, free.length)}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setUnpicked(allPicked ? new Set(free.map((i) => i.id)) : new Set())}
          style={styles.textButton}
        >
          <Text style={styles.textButtonLabel}>
            {allPicked ? he.shop.clear : he.shop.selectAll}
          </Text>
        </Pressable>
      </View>
      <View>
        {free.map((item) => {
          const on = !unpicked.has(item.id);
          return (
            <Pressable
              key={item.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => toggle(item.id)}
              style={styles.row}
            >
              <View style={[styles.box, on && styles.boxOn]}>
                {on && <Icon name="check" size={14} color={colors.onPrimary} strokeWidth={3.5} />}
              </View>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.qty}>{buyQuantity(item)}</Text>
            </Pressable>
          );
        })}
      </View>
      {taken.length > 0 && (
        <>
          <Text style={styles.caption}>{he.shop.taken}</Text>
          {taken.map(({ item, holder }) => (
            <View key={item.id} style={styles.takenRow}>
              <Avatar person={view.avatarOf(holder)} size={avatarSize.sm} />
              <Text style={[styles.name, styles.muted, styles.regular]}>
                {[item.name, buyQuantity(item)].filter(Boolean).join(' ')}
              </Text>
              <Text style={styles.qty}>{view.nameOf(holder)}</Text>
            </View>
          ))}
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  caption: { ...type.caption, fontFamily: type.itemTitle.fontFamily, color: colors.inkMuted },
  textButton: { minHeight: space.touch, justifyContent: 'center', paddingHorizontal: space[1] },
  textButtonLabel: { ...type.buttonSm, color: colors.primaryStrong },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 48 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.inkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  name: { ...type.itemTitle, color: colors.ink, flex: 1 },
  muted: { color: colors.inkMuted },
  regular: { fontFamily: type.body.fontFamily },
  qty: { ...type.caption, color: colors.inkMuted },
  takenRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 40 },
});
