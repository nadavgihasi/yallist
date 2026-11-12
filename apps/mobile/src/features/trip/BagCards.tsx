import { bagSuggestions, broughtNotInBag, type BagItem, type BagSuggestion } from '@yallist/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CheckRow } from '@/components/CheckRow';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { showToast } from '@/components/Toast';
import { bagLine, he, joinNames } from '@/i18n/he';
import { rtl } from '@/lib/bidi';
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
 * The top of the bring list: one line for what my bag marked and the common items in it that
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
      {(marked > 0 || offers.length > 0) && (
        <BagLine tripId={data.trip.id} marked={marked} offers={offers} />
      )}
      {brought.length > 0 && <AddBrought tripId={data.trip.id} brought={brought} />}
    </>
  );
}

/**
 * One line for the bag: how many per-person items it marked, and the common items in it that
 * nobody brings yet, with "all on me" and ✕ for not this trip. Tapping the text opens the sheet
 * that picks some of them.
 */
function BagLine({
  tripId,
  marked,
  offers,
}: {
  tripId: string;
  marked: number;
  offers: BagSuggestion[];
}) {
  const [dismissed, dismiss] = useDismissed(`bag-offer/${tripId}`);
  const take = useTakeFromBag(tripId);
  // Unknown (still reading) counts as dismissed, so the offer doesn't flash.
  const offer = dismissed === false && offers.length > 0;
  if (!offer && marked === 0) return null;
  const text = bagLine(marked, offer ? offers.length : 0);
  const body = (
    <>
      <Icon name="bag" color={colors.primaryStrong} />
      <Text style={styles.noteText} numberOfLines={2}>
        {text}
      </Text>
    </>
  );
  if (!offer) {
    return (
      <View style={styles.note} {...testId('bag-marked')}>
        {body}
      </View>
    );
  }
  return (
    <View style={styles.note} {...testId('bag-offer')}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${text}. ${he.bag.offerText(joinNames(offers.map((o) => rtl(o.item.name))))}`}
        onPress={() => router.push({ pathname: '/trips/[tripId]/bag', params: { tripId } })}
        style={({ pressed }) => [styles.noteBody, pressed && styles.pressed]}
        {...testId('bag-offer-choose')}
      >
        {body}
      </Pressable>
      <PillButton
        label={he.bag.offerAll}
        size="sm"
        onPress={() => take(offers)}
        {...testId('bag-offer-all')}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={he.bag.offerDismiss}
        onPress={dismiss}
        style={styles.lineClose}
        {...testId('bag-offer-dismiss')}
      >
        <Icon name="close" size={20} color={colors.inkMuted} />
      </Pressable>
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
  // One line: the text, then "all on me" and ✕ at its end.
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: 56,
    paddingVertical: space[2],
    paddingHorizontal: space[4],
    borderRadius: radius.card,
    backgroundColor: colors.primaryTint,
  },
  noteBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[3] },
  noteText: { ...type.caption, color: colors.ink, flex: 1 },
  pressed: { opacity: 0.75 },
  // A 44px target at the line's end.
  lineClose: {
    width: space.touch,
    height: space.touch,
    marginEnd: -space[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  inner: {
    borderRadius: 16,
    backgroundColor: colors.card,
    paddingVertical: space[1],
    paddingHorizontal: space[4],
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
});
