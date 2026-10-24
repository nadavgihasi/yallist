import { QUICK_SUGGESTIONS, TEMPLATES, type ItemKind, type ListKind } from '@yallist/domain';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ChipGroup, FilterChip, SuggestionChip } from '@/components/Chips';
import { SegmentedControl, Switch } from '@/components/Controls';
import { fieldStyles } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { closeSheet } from '@/features/trip/closeSheet';
import { he } from '@/i18n/he';
import { buildItem } from '@/state/reducer';
import { useDispatch, useMe, useTrip } from '@/state/store';
import { colors, fonts } from '@/theme';

const KINDS: ItemKind[] = ['single', 'qty', 'each'];

/** Categories already in this list, plus the template defaults, so there's always something to pick. */
function categoriesFor(list: ListKind, existing: string[]): string[] {
  const defaults = TEMPLATES.camp.filter((t) => t.list === list).map((t) => t.category);
  return [...new Set([...existing, ...defaults])];
}

export default function AddItem() {
  const params = useLocalSearchParams<{ tripId: string; list?: ListKind }>();
  const data = useTrip(params.tripId);
  const me = useMe().userId;
  const dispatch = useDispatch();
  const [list, setList] = useState<ListKind>(params.list === 'buy' ? 'buy' : 'bring');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ItemKind>('single');
  const [qty, setQty] = useState(4);
  const [category, setCategory] = useState<string>();
  const [claim, setClaim] = useState(false);

  const close = () => closeSheet(params.tripId);
  if (!data) return null;

  const categories = categoriesFor(
    list,
    data.items.filter((i) => i.list === list).map((i) => i.category),
  );
  const pickedCategory = category && categories.includes(category) ? category : categories[0]!;
  const trimmed = name.trim();

  const add = () => {
    if (!trimmed) return;
    const item = buildItem(
      {
        list,
        name: trimmed,
        kind,
        quantityNeeded: kind === 'qty' ? qty : 1,
        category: pickedCategory,
      },
      data.items,
    );
    dispatch({ type: 'addItem', tripId: data.trip.id, item });
    if (claim) {
      dispatch({
        type: 'setClaim',
        tripId: data.trip.id,
        itemId: item.id,
        userId: me,
        quantity: kind === 'qty' ? qty : 1,
      });
    }
    close();
  };

  const claimLabel =
    kind === 'each'
      ? he.addItem.claimEach
      : list === 'bring'
        ? he.addItem.claimBring
        : he.addItem.claimBuy;

  return (
    <Sheet
      title={he.addItem.title}
      onClose={close}
      footer={
        <PillButton
          label={he.addItem.cta(trimmed, list)}
          size="xl"
          wide
          disabled={!trimmed}
          onPress={add}
        />
      }
    >
      <SegmentedControl
        options={[
          { value: 'bring', label: he.trip.tabs.bring },
          { value: 'buy', label: he.trip.tabs.buy },
        ]}
        value={list}
        onChange={setList}
      />

      <View style={styles.field}>
        <Text style={fieldStyles.label}>{he.addItem.what}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          onSubmitEditing={add}
          returnKeyType="done"
          placeholder={he.addItem.placeholder[list]}
          placeholderTextColor={colors.inkTertiary}
          accessibilityLabel={he.addItem.what}
          autoFocus
          style={styles.input}
        />
        <View style={styles.wrap}>
          {QUICK_SUGGESTIONS[list].map((s) => (
            <SuggestionChip key={s} label={s} onPress={() => setName(s)} />
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={fieldStyles.label}>{he.addItem.howMany}</Text>
        <View
          style={styles.kinds}
          accessibilityRole="radiogroup"
          accessibilityLabel={he.addItem.howMany}
        >
          {KINDS.map((k) => {
            const selected = k === kind;
            const [label, hint] = he.addItem.kinds[k];
            return (
              <Pressable
                key={k}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setKind(k)}
                style={[styles.kind, selected && styles.kindOn]}
              >
                <Text style={styles.kindLabel}>{label}</Text>
                <Text style={styles.kindHint}>{hint}</Text>
              </Pressable>
            );
          })}
        </View>
        {kind === 'qty' && (
          <View style={styles.qtyRow}>
            <Text style={styles.qtyLabel}>{he.addItem.total}</Text>
            <View style={styles.qtyControls}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={he.trip.plusOne}
                onPress={() => setQty(qty + 1)}
                style={styles.qtyButton}
              >
                <Icon name="plus" size={20} />
              </Pressable>
              <Text style={styles.qtyValue}>{qty}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={he.trip.minusOne}
                disabled={qty <= 2}
                onPress={() => setQty(qty - 1)}
                style={[styles.qtyButton, qty <= 2 && { opacity: 0.35 }]}
              >
                <Icon name="minus" size={20} />
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <View style={styles.field}>
        <Text style={fieldStyles.label}>{he.addItem.category}</Text>
        <ChipGroup label={he.addItem.category}>
          {categories.map((c) => (
            <FilterChip
              key={c}
              label={c}
              selected={c === pickedCategory}
              onPress={() => setCategory(c)}
            />
          ))}
        </ChipGroup>
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>{claimLabel}</Text>
        <Switch value={claim} onChange={setClaim} label={claimLabel} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  field: { gap: 10 },
  input: {
    minHeight: 60,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(14,23,38,0.05)',
    fontFamily: fonts.regular,
    fontSize: 19,
    color: colors.ink,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kinds: { flexDirection: 'row', gap: 8 },
  kind: {
    flex: 1,
    minHeight: 84,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'rgba(14,23,38,0.05)',
    gap: 4,
  },
  kindOn: { borderColor: colors.accent, backgroundColor: colors.accentTint },
  kindLabel: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  kindHint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.inkSecondary },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(14,23,38,0.05)',
  },
  qtyLabel: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    minWidth: 36,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.ink,
  },
  switchRow: {
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(14,23,38,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
});
