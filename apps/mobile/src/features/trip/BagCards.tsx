import { bagSuggestions, broughtNotInBag, type BagItem, type BagSuggestion } from '@yallist/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CheckRow } from '@/components/CheckRow';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { showToast } from '@/components/Toast';
import { he, joinNames } from '@/i18n/he';
import { countdown } from '@/lib/dates';
import { testId } from '@/lib/testId';
import { useDismissed } from '@/lib/useDismissed';
import { useToday } from '@/lib/useToday';
import { useBagChange } from '@/state/bag';
import { useTripAction } from '@/state/trips';
import type { TripData } from '@/state/types';
import { colors, radius, space, type } from '@/theme';

import type { TripView } from './derive';

/** Puts the suggested common items on me, with a toast that undoes it. */
export function useTakeFromBag(tripId: string) {
  const act = useTripAction(tripId);
  return (taken: readonly BagSuggestion[]) => {
    for (const { item, quantity } of taken) act({ type: 'setClaim', itemId: item.id, quantity });
    showToast(he.bag.taken(taken.length), 'success', {
      label: he.bag.undo,
      onPress: () => {
        for (const { item } of taken) act({ type: 'setClaim', itemId: item.id, quantity: 0 });
      },
    });
  };
}

/**
 * The top of the bring list: how many per-person items my bag marked, common items in my bag that
 * nobody brings yet, and once the trip is over, what I brought that my bag doesn't have.
 */
export function BagCards({
  data,
  view,
  me,
  bag,
}: {
  data: TripData;
  view: TripView;
  me: string;
  bag: readonly BagItem[];
}) {
  const ended = countdown(data.trip.startsOn, data.trip.endsOn, useToday()).phase === 'after';
  const marked = data.claims.filter((c) => c.userId === me && c.fromBag && !c.packed).length;
  const offers = ended ? [] : bagSuggestions(view.items, data.claims, bag);
  const brought = ended ? broughtNotInBag(view.items, data.claims, bag, me) : [];
  return (
    <>
      {marked > 0 && (
        <View style={styles.note} {...testId('bag-marked')}>
          <Icon name="bag" color={colors.primaryStrong} />
          <Text style={styles.noteText}>{he.bag.marked(marked)}</Text>
        </View>
      )}
      {offers.length > 0 && <Offer tripId={data.trip.id} offers={offers} />}
      {brought.length > 0 && <AddBrought tripId={data.trip.id} brought={brought} />}
    </>
  );
}

/** "3 items are already in your bag": all on me, pick some, or not for this trip. */
function Offer({ tripId, offers }: { tripId: string; offers: BagSuggestion[] }) {
  const [dismissed, dismiss] = useDismissed(`bag-offer/${tripId}`);
  const take = useTakeFromBag(tripId);
  if (dismissed !== false) return null;
  return (
    <View style={styles.card} {...testId('bag-offer')}>
      <View style={styles.head}>
        <Icon name="bag" color={colors.primaryStrong} />
        <View style={styles.texts}>
          <Text style={styles.title}>{he.bag.offerTitle(offers.length)}</Text>
          <Text style={styles.caption}>
            {he.bag.offerText(joinNames(offers.map((o) => o.item.name)))}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={he.bag.offerDismiss}
          onPress={dismiss}
          style={styles.close}
          {...testId('bag-offer-dismiss')}
        >
          <Icon name="close" size={20} color={colors.inkMuted} />
        </Pressable>
      </View>
      <View style={styles.actions}>
        <PillButton
          label={he.bag.offerAll}
          onPress={() => take(offers)}
          {...testId('bag-offer-all')}
        />
        <PillButton
          label={he.bag.offerChoose}
          variant="card"
          onPress={() => router.push({ pathname: '/trips/[tripId]/bag', params: { tripId } })}
          {...testId('bag-offer-choose')}
        />
      </View>
    </View>
  );
}

/** The trip is over: add what I brought to my bag, so next time it's marked by itself. */
function AddBrought({
  tripId,
  brought,
}: {
  tripId: string;
  brought: { name: string; quantity: number }[];
}) {
  const [dismissed, dismiss] = useDismissed(`bag-end/${tripId}`);
  const change = useBagChange();
  const [unpicked, setUnpicked] = useState<ReadonlySet<string>>(new Set());
  if (dismissed !== false) return null;
  const picked = brought.filter((b) => !unpicked.has(b.name));
  const toggle = (name: string) =>
    setUnpicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(name)) next.add(name);
      return next;
    });
  return (
    <View style={styles.card} {...testId('bag-end')}>
      <View style={styles.head}>
        <Icon name="bag" color={colors.primaryStrong} />
        <View style={styles.texts}>
          <Text style={styles.title}>{he.bag.endTitle(brought.length)}</Text>
          <Text style={styles.caption}>{he.bag.endText}</Text>
        </View>
      </View>
      <View style={styles.inner}>
        {brought.map((b) => (
          <CheckRow
            key={b.name}
            label={b.name}
            checked={!unpicked.has(b.name)}
            onToggle={() => toggle(b.name)}
          />
        ))}
      </View>
      <View style={styles.actions}>
        <PillButton
          label={he.bag.endSave(picked.length)}
          disabled={picked.length === 0}
          onPress={() =>
            change.mutate(
              { type: 'add', items: picked },
              { onSuccess: () => showToast(he.bag.added, 'success') },
            )
          }
          {...testId('bag-end-save')}
        />
        <PillButton label={he.bag.endLater} variant="card" onPress={dismiss} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: 14,
    paddingHorizontal: space[5],
    borderRadius: radius.card,
    backgroundColor: colors.primaryTint,
  },
  noteText: { ...type.caption, color: colors.ink, flex: 1 },
  card: {
    gap: space[4],
    padding: space[5],
    borderRadius: radius.card,
    backgroundColor: colors.primaryTint,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  texts: { flex: 1, gap: 2 },
  title: { ...type.itemTitle, color: colors.ink },
  caption: { ...type.caption, color: colors.inkMuted },
  // A 44px target in the card's corner.
  close: {
    width: space.touch,
    height: space.touch,
    margin: -12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    borderRadius: 16,
    backgroundColor: colors.card,
    paddingVertical: space[1],
    paddingHorizontal: space[4],
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
