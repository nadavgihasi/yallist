import { myBag, suggestions, type BagEntry } from '@yallist/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { Progress } from '@/components/Progress';
import { StatusRing } from '@/components/StatusRing';
import { he } from '@/i18n/he';
import { formatShort } from '@/lib/dates';
import { testId } from '@/lib/testId';
import { useEssentials } from '@/state/essentials';
import { useTripAction } from '@/state/trips';
import type { TripData } from '@/state/types';
import { colors, space, type } from '@/theme';

import type { TripView } from './derive';
import { pressed } from './ItemRow';
import { bagLabel, bagName } from './bag';

/**
 * התיק שלי (packing spec §6.2): everything I bring, to tick off as it goes into the bag. What I
 * took for the group, which the group sees packed, and my private items, which only I see.
 */
export function BagTab({ data, view, me }: { data: TripData; view: TripView; me: string }) {
  const act = useTripAction(data.trip.id);
  // The private item whose delete was tapped once; a second tap deletes it.
  const [confirming, setConfirming] = useState<string>();
  const { essentials = [], pastItems = [] } = useEssentials().data ?? {};
  const tripItems = [...view.items, ...data.privateItems];
  const bought = new Set(data.expenses.flatMap((e) => e.itemIds ?? []));
  const { group, mine, packed, total } = myBag(me, tripItems, data.claims, bought, essentials);
  const maybe = suggestions(tripItems, pastItems, essentials);

  const row = (entry: BagEntry, removable: boolean) => {
    const { item } = entry;
    const armed = confirming === item.id;
    return (
      <View key={item.id} style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={entry.packed ? he.trip.unpack : he.trip.pack}
          {...pressed(entry.packed)}
          {...testId(entry.packed ? 'bag-unpack' : 'bag-pack')}
          onPress={() => act({ type: 'setPacked', itemId: item.id, packed: !entry.packed })}
          style={styles.toggle}
        >
          <StatusRing state={entry.packed ? 'done' : 'held'} label={he.status.packed} />
        </Pressable>
        <View style={styles.main}>
          <Text style={styles.name}>{bagName(entry)}</Text>
          {!!bagLabel(entry) && <Text style={styles.caption}>{bagLabel(entry)}</Text>}
        </View>
        {removable && (
          <PillButton
            label={armed ? he.bag.confirmDelete : he.bag.delete}
            accessibilityLabel={armed ? undefined : he.bag.deleteLabel(item.name)}
            variant={armed ? 'danger' : 'quiet'}
            size="sm"
            {...testId('bag-delete')}
            onPress={() => {
              if (!armed) return setConfirming(item.id);
              act({ type: 'deleteItem', itemId: item.id });
              setConfirming(undefined);
            }}
          />
        )}
      </View>
    );
  };

  // "אולי גם": one tap puts it in my bag.
  const chips = maybe.length > 0 && (
    <View style={styles.chips}>
      <Text style={styles.caption}>{he.bag.maybe}</Text>
      {maybe.map((name) => (
        <PillButton
          key={name}
          label={name}
          variant="soft"
          size="sm"
          icon={<Icon name="plus" size={16} color={colors.primaryStrong} strokeWidth={2.5} />}
          {...testId('bag-suggestion')}
          onPress={() => act({ type: 'addPrivateItem', name })}
        />
      ))}
    </View>
  );
  const essentialsRow = (
    <Pressable
      accessibilityRole="button"
      {...testId('bag-essentials')}
      onPress={() => router.push('/essentials')}
      style={styles.essentials}
    >
      <Text style={styles.essentialsText}>{he.bag.essentialsRow(essentials.length)}</Text>
      <Icon name="chevronEnd" size={18} color={colors.inkMuted} />
    </Pressable>
  );

  if (total === 0) {
    return (
      <View style={styles.wrap}>
        <EmptyState spot={data.trip.cover} {...he.bag.empty}>
          {chips}
        </EmptyState>
        {essentialsRow}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Card gap={space[2]}>
        <View style={styles.header}>
          <Text style={styles.progress} {...testId('bag-progress')}>
            {he.bag.packedOf(packed, total)}
          </Text>
          {/* Trips have a start date but no time yet, so the date. */}
          <Text style={styles.caption}>{formatShort(data.trip.startsOn)}</Text>
        </View>
        <Progress done={packed} total={total} />
      </Card>
      {group.length > 0 && (
        <Card gap={space[2]}>
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {he.bag.group}
            </Text>
            <Text style={styles.small}>{he.bag.groupCaption}</Text>
          </View>
          {group.map((e) => row(e, false))}
        </Card>
      )}
      {(mine.length > 0 || chips) && (
        <Card gap={space[2]}>
          <View style={styles.header}>
            <View style={styles.lockTitle}>
              <Icon name="lock" size={16} color={colors.inkMuted} strokeWidth={2.2} />
              <Text style={styles.title} accessibilityRole="header">
                {he.bag.mine}
              </Text>
            </View>
            <Text style={styles.small}>{he.bag.mineCaption}</Text>
          </View>
          {mine.map((e) => row(e, true))}
          {chips}
        </Card>
      )}
      {essentialsRow}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[4] },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[3],
  },
  lockTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...type.caption, fontFamily: type.itemTitle.fontFamily, color: colors.inkMuted },
  progress: { ...type.itemTitle, color: colors.ink },
  caption: { ...type.caption, color: colors.inkMuted },
  small: { ...type.caption, fontSize: 13, lineHeight: 18, color: colors.inkMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: space.touch },
  // A 44px target around the 28px ring, in the ring's place in the row.
  toggle: {
    width: space.touch,
    height: space.touch,
    margin: (28 - space.touch) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...type.itemTitle, color: colors.ink },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[2],
    paddingTop: space[1],
  },
  essentials: {
    minHeight: space.touch,
    paddingHorizontal: space[5],
    borderRadius: 999,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  essentialsText: { ...type.buttonSm, color: colors.primaryStrong },
});
