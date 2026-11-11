import { heldCatalogNames, sameItem, type BagItem } from '@yallist/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CatalogPicker } from '@/components/CatalogPicker';
import { EmptyState } from '@/components/EmptyState';
import { TextField } from '@/components/Fields';
import { FLOATING_CLEARANCE, FloatingAction } from '@/components/FloatingAction';
import { Icon, type IconName } from '@/components/Icon';
import { ItemIcon } from '@/components/ItemIcon';
import { Card } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { Skeleton } from '@/components/Skeleton';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useBag, useBagChange } from '@/state/bag';
import { colors, layout, size, space, type } from '@/theme';

const MAX_QUANTITY = 99;

/**
 * My bag (התיק שלי): what I always have at home, each with how many. Per-person items of the same
 * name are marked as mine in every trip; common ones are offered to me.
 */
export default function BagScreen() {
  const insets = useSafeAreaInsets();
  const bag = useBag();
  const change = useBagChange();
  const [adding, setAdding] = useState(false);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: space[6] + insets.top }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={he.bag.back}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/profile'))}
            style={styles.back}
          >
            <Icon name="back" strokeWidth={2.5} />
          </Pressable>
          <Text style={styles.h1} accessibilityRole="header" {...testId('bag-title')}>
            {he.bag.title}
          </Text>
        </View>
        <Text style={styles.caption}>{he.bag.intro}</Text>

        {adding && bag.data && (
          <AddItem
            bag={bag.data}
            onAdd={(name) => change.mutate({ type: 'add', items: [{ name, quantity: 1 }] })}
            onDone={() => setAdding(false)}
          />
        )}

        {bag.data ? (
          bag.data.length > 0 ? (
            <Card gap={0} style={styles.list}>
              {bag.data.map((item) => (
                <BagRow
                  key={item.id}
                  item={item}
                  onQuantity={(quantity) =>
                    quantity === 0
                      ? change.mutate({ type: 'remove', id: item.id })
                      : change.mutate({ type: 'setQuantity', id: item.id, quantity })
                  }
                />
              ))}
            </Card>
          ) : (
            !adding && <EmptyState spot="camp" {...he.bag.empty} />
          )
        ) : bag.isError ? (
          <EmptyState
            spot="noSignal"
            {...he.states.offline}
            actions={[{ label: he.errors.retry, onPress: () => void bag.refetch() }]}
          />
        ) : (
          <Skeleton>
            <Skeleton.Card>
              {[50, 40, 60].map((w) => (
                <Skeleton.Line key={w} width={`${w}%`} />
              ))}
            </Skeleton.Card>
          </Skeleton>
        )}
        <View style={{ height: FLOATING_CLEARANCE + insets.bottom }} />
      </ScrollView>
      {!adding && bag.data && (
        <FloatingAction label={he.bag.add} testID="bag-add" onPress={() => setAdding(true)} />
      )}
    </View>
  );
}

/** The name field for a new item; stays open after adding, for the next one. */
function AddItem({
  bag,
  onAdd,
  onDone,
}: {
  bag: readonly BagItem[];
  onAdd: (name: string) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const exists = bag.some((b) => sameItem(b.name, trimmed));
  const add = () => {
    if (!trimmed || exists) return;
    onAdd(trimmed);
    setName('');
  };
  return (
    <Card gap={space[3]}>
      <TextField
        label={he.bag.addLabel}
        value={name}
        onChangeText={setName}
        placeholder={he.bag.addPlaceholder}
        onSubmitEditing={add}
        submitBehavior="submit"
        returnKeyType="done"
        maxLength={80}
        autoFocus
        error={exists ? he.bag.exists : undefined}
        {...testId('bag-add-name')}
      />
      <CatalogPicker
        query={name}
        list="bring"
        exclude={heldCatalogNames(bag.map((b) => b.name))}
        onPick={(entry) => {
          onAdd(entry.name);
          setName('');
        }}
      />
      <View style={styles.actions}>
        <PillButton
          label={he.bag.addSave}
          disabled={!trimmed || exists}
          onPress={add}
          {...testId('bag-add-save')}
        />
        <PillButton label={he.close} variant="quiet" onPress={onDone} />
      </View>
    </Card>
  );
}

/** A name and its count, "− 2 +"; at 1 the minus becomes a remove. */
function BagRow({ item, onQuantity }: { item: BagItem; onQuantity: (quantity: number) => void }) {
  const last = item.quantity === 1;
  return (
    <View style={styles.row}>
      <ItemIcon name={item.name} />
      <Text style={styles.name}>{item.name}</Text>
      <View style={styles.stepper}>
        <Step
          icon="plus"
          label={he.bag.more(item.name)}
          disabled={item.quantity >= MAX_QUANTITY}
          onPress={() => onQuantity(item.quantity + 1)}
        />
        <Text style={styles.count}>{item.quantity}</Text>
        <Step
          icon={last ? 'trash' : 'minus'}
          label={last ? he.bag.remove(item.name) : he.bag.less(item.name)}
          onPress={() => onQuantity(item.quantity - 1)}
        />
      </View>
    </View>
  );
}

function Step({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.step, disabled && styles.disabled]}
    >
      <View style={styles.stepCircle}>
        <Icon name={icon} size={18} color={colors.primaryStrong} strokeWidth={2.5} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: {
    width: '100%',
    maxWidth: layout.contentMax,
    alignSelf: 'center',
    paddingHorizontal: space.screen,
    gap: space[4],
  },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  back: {
    width: size.avatar,
    height: size.avatar,
    borderRadius: size.avatar / 2,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  h1: { ...type.sectionTitle, color: colors.ink, flexShrink: 1 },
  caption: { ...type.caption, color: colors.inkMuted },
  list: { paddingVertical: space[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 56 },
  name: { ...type.itemTitle, color: colors.ink, flex: 1 },
  // Plus at the start in RTL, as in the trip's stepper.
  stepper: { flexDirection: 'row', alignItems: 'center', marginHorizontal: -6 },
  step: { width: space.touch, height: space.touch, alignItems: 'center', justifyContent: 'center' },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.3 },
  count: {
    minWidth: 20,
    textAlign: 'center',
    ...type.itemTitle,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  actions: { flexDirection: 'row', gap: space[2] },
});
