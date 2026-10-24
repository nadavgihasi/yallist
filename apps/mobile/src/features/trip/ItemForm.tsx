import { QUICK_SUGGESTIONS, type Item, type ItemKind, type ListKind } from '@yallist/domain';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChipGroup, FilterChip, SuggestionChip } from '@/components/Chips';
import { SegmentedControl, Switch } from '@/components/Controls';
import { Input, fieldStyles } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { he } from '@/i18n/he';
import type { NewItemInput } from '@/state/reducer';
import { useTrip } from '@/state/trips';
import { colors, fonts } from '@/theme';

const KINDS: ItemKind[] = ['single', 'qty', 'each'];

/** Marks the "new category" chip as the picked category. */
const NEW = 'new';

/**
 * The add-item sheet, also used to edit an item: `item` prefills it. Claiming is only offered
 * for a new item; an existing one is claimed from its sheet. A category can be created on the
 * spot: `onSubmit` then gets its name as `newCategory`.
 */
export function ItemForm({
  tripId,
  item,
  list: initialList = 'bring',
  categoryId: initialCategory,
  onSubmit,
  onClose,
}: {
  tripId: string;
  item?: Item;
  list?: ListKind;
  /** Preselected for a new item, e.g. when added from inside a category. */
  categoryId?: string;
  onSubmit: (item: NewItemInput, claim: boolean, newCategory?: string) => void;
  onClose: () => void;
}) {
  const data = useTrip(tripId);
  const [list, setList] = useState<ListKind>(item?.list ?? initialList);
  const [name, setName] = useState(item?.name ?? '');
  const [kind, setKind] = useState<ItemKind>(item?.kind ?? 'single');
  const [qty, setQty] = useState(item?.kind === 'qty' ? item.quantityNeeded : 4);
  const [category, setCategory] = useState(item ? item.categoryId : initialCategory);
  const [newName, setNewName] = useState('');
  const [claim, setClaim] = useState(false);

  if (!data) return null;

  const categories = data.categories
    .filter((c) => c.list === list)
    .sort((a, b) => a.position - b.position);
  // A category of the other list (after switching lists) doesn't apply: uncategorized.
  const picked =
    category === NEW || categories.some((c) => c.id === category) ? category : undefined;
  const newCategory = newName.trim();
  // Typing an existing name picks that category instead of making a second one.
  const existing = categories.find((c) => c.name.toLowerCase() === newCategory.toLowerCase());
  const trimmed = name.trim();
  const valid = !!trimmed && (picked !== NEW || !!newCategory);

  const submit = () => {
    if (!valid) return;
    const quantityNeeded = kind === 'qty' ? qty : 1;
    const creating = picked === NEW && !existing;
    const categoryId = picked === NEW ? (existing?.id ?? null) : (picked ?? null);
    onSubmit(
      { list, name: trimmed, kind, quantityNeeded, categoryId },
      claim,
      creating ? newCategory : undefined,
    );
  };

  const claimLabel =
    kind === 'each'
      ? he.addItem.claimEach
      : list === 'bring'
        ? he.addItem.claimBring
        : he.addItem.claimBuy;

  return (
    <Sheet
      title={item ? he.editItem.title : he.addItem.title}
      onClose={onClose}
      footer={
        <PillButton
          label={item ? he.editItem.save : he.addItem.cta(trimmed, list)}
          size="lg"
          wide
          disabled={!valid}
          onPress={submit}
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
        <Input
          value={name}
          onChangeText={setName}
          onSubmitEditing={submit}
          returnKeyType="done"
          placeholder={he.addItem.placeholder[list]}
          accessibilityLabel={he.addItem.what}
          autoFocus={!item}
          style={styles.input}
        />
        {!item && (
          <View style={styles.wrap}>
            {QUICK_SUGGESTIONS[list].map((s) => (
              <SuggestionChip key={s} label={s} onPress={() => setName(s)} />
            ))}
          </View>
        )}
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
              key={c.id}
              label={c.name}
              selected={c.id === picked}
              onPress={() => setCategory(c.id)}
            />
          ))}
          <FilterChip
            label={he.trip.uncategorized}
            selected={picked === undefined}
            onPress={() => setCategory(undefined)}
          />
          <FilterChip
            label={`+ ${he.addItem.newCategory}`}
            selected={picked === NEW}
            onPress={() => setCategory(NEW)}
          />
        </ChipGroup>
        {picked === NEW && (
          <Input
            value={newName}
            onChangeText={setNewName}
            placeholder={he.category.placeholder}
            accessibilityLabel={he.category.name}
            maxLength={40}
            autoFocus
            style={styles.input}
          />
        )}
      </View>

      {!item && (
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{claimLabel}</Text>
          <Switch value={claim} onChange={setClaim} label={claimLabel} />
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  field: { gap: 10 },
  input: {
    minHeight: 60,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: colors.ground,
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
    backgroundColor: colors.ground,
    gap: 4,
  },
  kindOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  kindLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  kindHint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, color: colors.inkMuted },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: colors.ground,
  },
  qtyLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    minWidth: 36,
    textAlign: 'center',
    fontFamily: fonts.extraBold,
    fontSize: 24,
    color: colors.ink,
  },
  switchRow: {
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: colors.ground,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
});
