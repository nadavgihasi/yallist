import { BULK_MAX_ITEMS } from '@yallist/domain';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CheckRow } from '@/components/CheckRow';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { showToast } from '@/components/Toast';
import { he, itemsCount } from '@/i18n/he';
import { formatRange } from '@/lib/dates';
import { testId } from '@/lib/testId';
import { useCopyItems, useSourceTrip } from '@/state/bulk';
import { useTrip, useTrips } from '@/state/trips';
import type { TripData } from '@/state/types';
import { colors, fonts, space, type } from '@/theme';

import { useCloseSheet } from '../closeSheet';
import { copyEntries, copyGroups, copyPicked, copySources, type CopyEntry } from './copyState';

/**
 * Copying items from another trip of mine: pick the trip, see its bring and buy items ticked,
 * untick what isn't needed this time, and add the rest in one request. What they are comes along
 * (name, count, unit, category); what happened to them there doesn't.
 */
export function CopyFromTripSheet({ tripId }: { tripId: string }) {
  const data = useTrip(tripId);
  const trips = useTrips();
  const close = useCloseSheet(tripId);
  const [fromTripId, setFromTripId] = useState<string>();

  if (!data) return null;
  const sources = copySources(trips.data?.trips ?? [], tripId);
  const from = sources.find((s) => s.trip.id === fromTripId);

  if (from) {
    return (
      <SourceItems
        data={data}
        from={from.trip}
        onBack={() => setFromTripId(undefined)}
        onClose={close}
      />
    );
  }

  return (
    <Sheet
      title={he.bulk.copy.title}
      subtitle={he.bulk.copy.pickTrip}
      onClose={close}
      gap={space[2]}
    >
      {trips.isPending ? (
        <Text style={styles.caption}>{he.states.loading}</Text>
      ) : sources.length === 0 ? (
        <Text style={styles.caption}>{he.bulk.copy.none}</Text>
      ) : (
        sources.map(({ trip, itemCount }) => (
          <Pressable
            key={trip.id}
            accessibilityRole="button"
            onPress={() => setFromTripId(trip.id)}
            style={styles.trip}
            {...testId(`copy-trip-${trip.id}`)}
          >
            <View style={styles.flex}>
              <Text style={styles.tripName}>{trip.name}</Text>
              <Text style={styles.caption}>
                {[formatRange(trip.startsOn, trip.endsOn), itemsCount(itemCount)].join(' · ')}
              </Text>
            </View>
          </Pressable>
        ))
      )}
    </Sheet>
  );
}

/** The source trip's items, all ticked but what this trip has. */
function SourceItems({
  data,
  from,
  onBack,
  onClose,
}: {
  data: TripData;
  from: { id: string; name: string };
  onBack: () => void;
  onClose: (then?: () => void) => void;
}) {
  const tripId = data.trip.id;
  const source = useSourceTrip(from.id);
  const copy = useCopyItems(tripId);
  const [unpicked, setUnpicked] = useState<ReadonlySet<string>>(new Set());
  // Set at once on the first tap, unlike `isPending`: a double tap sends one request.
  const sending = useRef(false);

  const entries = source.data ? copyEntries(source.data, data.items) : [];
  const pickable = entries.filter((e) => e.status === 'add');
  const picked = copyPicked(entries, unpicked);
  const exists = entries.filter((e) => e.status === 'exists').length;
  const tooMany = picked.length > BULK_MAX_ITEMS;
  const allPicked = picked.length === pickable.length;
  const canSave = picked.length > 0 && !tooMany && !copy.isPending;

  const toggle = (id: string) =>
    setUnpicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const save = () => {
    if (!canSave || sending.current) return;
    sending.current = true;
    copy.mutate(
      { fromTripId: from.id, itemIds: picked },
      {
        onSettled: () => {
          sending.current = false;
        },
        onSuccess: ({ added, skipped }) => {
          onClose();
          showToast(he.bulk.added(added.length, exists + skipped.length));
        },
        onError: () => showToast(he.bulk.failed, 'error'),
      },
    );
  };

  return (
    <Sheet
      title={from.name}
      subtitle={he.bulk.copy.hint}
      onClose={onClose}
      gap={space[3]}
      footer={
        <View style={styles.footer}>
          {tooMany && (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {he.bulk.tooMany(BULK_MAX_ITEMS)}
            </Text>
          )}
          <PillButton
            label={he.bulk.cta(picked.length)}
            size="lg"
            wide
            disabled={!canSave}
            onPress={save}
            {...testId('copy-save')}
          />
        </View>
      }
    >
      <Pressable accessibilityRole="button" onPress={onBack} style={styles.textButton}>
        <Text style={styles.textButtonLabel}>{he.bulk.copy.back}</Text>
      </Pressable>
      {source.isPending ? (
        <Text style={styles.caption}>{he.states.loading}</Text>
      ) : source.isError ? (
        <Text style={styles.error}>{he.errors.failed}</Text>
      ) : (
        <>
          <View style={styles.head}>
            <Text style={styles.caption}>
              {he.bulk.copy.picked(picked.length, pickable.length)}
            </Text>
            {pickable.length > 0 && (
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  setUnpicked(allPicked ? new Set(pickable.map((e) => e.id)) : new Set())
                }
                style={styles.textButton}
              >
                <Text style={styles.textButtonLabel}>
                  {allPicked ? he.shop.clear : he.shop.selectAll}
                </Text>
              </Pressable>
            )}
          </View>
          {copyGroups(entries).map(({ list, entries: group }) => (
            <View key={list}>
              <Text style={styles.group} accessibilityRole="header">
                {he.trip.tabs[list]}
              </Text>
              {group.map((entry) => (
                <SourceRow
                  key={entry.id}
                  entry={entry}
                  checked={!unpicked.has(entry.id)}
                  onToggle={() => toggle(entry.id)}
                />
              ))}
            </View>
          ))}
        </>
      )}
    </Sheet>
  );
}

function SourceRow({
  entry: { item, status },
  checked,
  onToggle,
}: {
  entry: CopyEntry;
  checked: boolean;
  onToggle: () => void;
}) {
  const detail = [
    item.kind === 'qty' ? he.bulk.qty(item.quantityNeeded) : item.kind === 'each' && he.bulk.each,
    item.displayQty,
    item.category,
  ]
    .filter(Boolean)
    .join(' · ');
  if (status !== 'add') {
    return (
      <View style={styles.skippedRow}>
        <Text style={[styles.flex, styles.skipped]}>{item.name}</Text>
        <Text style={styles.status}>{he.bulk.status[status]}</Text>
      </View>
    );
  }
  return <CheckRow label={item.name} detail={detail} checked={checked} onToggle={onToggle} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  caption: { ...type.caption, color: colors.inkMuted },
  trip: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: 20,
    backgroundColor: colors.ground,
  },
  tripName: { ...type.itemTitle, color: colors.ink },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  group: { ...type.caption, fontFamily: fonts.bold, color: colors.inkMuted, marginTop: space[2] },
  textButton: {
    minHeight: space.touch,
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: space[1],
  },
  textButtonLabel: { ...type.buttonSm, color: colors.primaryStrong },
  skippedRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 48 },
  skipped: { ...type.itemTitle, color: colors.inkFaint, textDecorationLine: 'line-through' },
  status: { ...type.caption, fontFamily: fonts.bold, color: colors.brandStrong },
  footer: { gap: space[2] },
  error: {
    ...type.caption,
    fontFamily: fonts.bold,
    color: colors.brandStrong,
    textAlign: 'center',
  },
});
