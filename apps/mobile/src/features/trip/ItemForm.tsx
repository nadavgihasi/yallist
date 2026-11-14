import {
  heldCatalogNames,
  type CatalogItem,
  type Item,
  type ItemKind,
  type ListKind,
} from '@yallist/domain';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CatalogPicker } from '@/components/CatalogPicker';
import { ChipGroup, FilterChip } from '@/components/Chips';
import { SegmentedControl, Switch } from '@/components/Controls';
import { Input, fieldStyles } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import type { NewItemInput } from '@/state/reducer';
import { useTrip } from '@/state/trips';
import { colors, fonts } from '@/theme';

import { AddManyLinks } from './bulk/AddManyLinks';
import {
  COUNTER_FROM,
  duplicateOf,
  fillFromCatalog,
  ITEM_NAME_MAX,
  NEW,
  toSave,
  typedCatalogItem,
  type Draft,
} from './addItem';
import {
  amountFields,
  buyAmountError,
  buyDisplayQty,
  countedByKind,
  initialBuyAmount,
} from './buyAmount';
import { BuyAmountField } from './BuyAmountField';

const KINDS: ItemKind[] = ['single', 'qty', 'each'];

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
  kind: initialKind = 'single',
  onSubmit,
  onOpen,
  onClose,
}: {
  tripId: string;
  item?: Item;
  list?: ListKind;
  /** Preselected for a new item, e.g. when added from inside a category. */
  categoryId?: string;
  /** Preselected for a new item, e.g. "each" when added from my own list. */
  kind?: ItemKind;
  /** A promise keeps the sheet saving until it settles; a rejection shows on the name field. */
  onSubmit: (item: NewItemInput, claim: boolean, newCategory?: string) => Promise<void> | void;
  /** Opens an item the list already has, offered when the new one would be a duplicate. */
  onOpen?: (itemId: string) => void;
  onClose: () => void;
}) {
  const data = useTrip(tripId);
  const [list, setList] = useState<ListKind>(item?.list ?? initialList);
  const [name, setName] = useState(item?.name ?? '');
  const [kind, setKind] = useState<ItemKind>(item?.kind ?? initialKind);
  const [qty, setQty] = useState(item?.kind === 'qty' ? item.quantityNeeded : 4);
  const [category, setCategory] = useState(item ? item.categoryId : initialCategory);
  const [newName, setNewName] = useState('');
  const [claim, setClaim] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  // The list, how many or the category set by hand: a catalog name typed in full then doesn't
  // override them.
  const [chosen, setChosen] = useState(false);
  // Added though the list has it: the duplicate warning was answered.
  const [anyway, setAnyway] = useState(false);
  // The buy list counts by amount and unit (`2 ק״ג`) instead of the bring list's kinds.
  const [buyAmount, setBuyAmount] = useState(() => initialBuyAmount(item));
  // Decided when the sheet opens, so the form doesn't change under the hand if someone takes it.
  const [byKind] = useState(
    () => !!item && countedByKind(item, !!data?.claims.some((c) => c.itemId === item.id)),
  );

  if (!data) return null;

  const draft: Draft = { list, name, kind, qty, category, newName };
  // A new item's name typed in full as the catalog has it (or another name for it) fills in its
  // count and category as tapping its suggestion would, shown on the form and under the field.
  const match = !item && !chosen ? typedCatalogItem(draft) : undefined;
  const shown = match ? fillFromCatalog(draft, match, data.categories) : draft;

  const categories = data.categories
    .filter((c) => c.list === list)
    .sort((a, b) => a.position - b.position);
  // A category of the other list (after switching lists) doesn't apply: uncategorized.
  const picked =
    shown.category === NEW || categories.some((c) => c.id === shown.category)
      ? shown.category
      : undefined;
  const trimmed = name.trim();
  // Only suggest what this list doesn't have yet.
  const taken = heldCatalogNames(data.items.filter((i) => i.list === list).map((i) => i.name));
  const byAmount = list === 'buy' && !byKind;
  const displayQty = buyDisplayQty(item, buyAmount);
  const valid =
    !!trimmed &&
    trimmed.length <= ITEM_NAME_MAX &&
    (picked !== NEW || !!shown.newName.trim()) &&
    (!byAmount || displayQty !== undefined);

  const draftSave = toSave(shown, data.categories);
  const save = {
    ...draftSave,
    item: { ...draftSave.item, ...amountFields(item, list, byAmount, displayQty ?? null) },
  };
  // A new item the list already has (by any of its names) warns before it goes in twice. Not while
  // saving: the item shows on the list at once, and would warn about itself.
  const duplicate =
    !item && !anyway && !saving && trimmed ? duplicateOf(data.items, save.item) : undefined;

  // A catalog item fills in the rest: its list, how it's counted and its category.
  const pick = (entry: CatalogItem) => {
    const next = fillFromCatalog(draft, entry, data.categories);
    setName(next.name);
    setList(next.list);
    setKind(next.kind);
    setQty(next.qty);
    setCategory(next.category);
    setNewName(next.newName);
  };
  // A choice by hand keeps what a typed catalog name filled in, then changes it.
  const choose =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      setKind(shown.kind);
      setQty(shown.qty);
      setCategory(shown.category);
      setNewName(shown.newName);
      set(value);
      setChosen(true);
    };

  const submit = (force = false) => {
    if (!valid || saving || (duplicate && !force)) return;
    if (force) setAnyway(true);
    const result = onSubmit(save.item, claim, save.newCategory);
    if (!result) return;
    setSaving(true);
    setFailed(false);
    // On success the sheet closes; on failure it stays, with the text, to try again.
    result.catch(() => {
      setSaving(false);
      setFailed(true);
    });
  };

  const claimLabel =
    shown.kind === 'each' && list === 'bring'
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
          label={item ? he.editItem.save : he.addItem.cta(save.item.name, list)}
          {...testId('item-form-save')}
          size="lg"
          wide
          disabled={!valid || saving || !!duplicate}
          onPress={() => submit()}
        />
      }
    >
      <SegmentedControl
        options={[
          { value: 'bring', label: he.trip.tabs.bring },
          { value: 'buy', label: he.trip.tabs.buy },
        ]}
        value={list}
        onChange={choose(setList)}
        style={{ backgroundColor: colors.ground }}
      />

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={fieldStyles.label}>{he.addItem.what}</Text>
          {name.length >= COUNTER_FROM && (
            <Text style={styles.counter} {...testId('item-form-counter')}>
              {he.addItem.count(name.length, ITEM_NAME_MAX)}
            </Text>
          )}
        </View>
        <Input
          value={name}
          onChangeText={(text) => {
            setName(text);
            setFailed(false);
            setAnyway(false);
          }}
          maxLength={ITEM_NAME_MAX}
          onSubmitEditing={() => submit()}
          returnKeyType="done"
          placeholder={he.addItem.placeholder[list]}
          accessibilityLabel={he.addItem.what}
          {...testId('item-form-name')}
          autoFocus={!item}
          style={styles.input}
        />
        {failed && (
          <Text style={fieldStyles.error} accessibilityLiveRegion="polite">
            {he.addItem.failed}
          </Text>
        )}
        {duplicate && (
          <View style={styles.duplicate} {...testId('item-form-duplicate')}>
            <Text style={fieldStyles.error} accessibilityLiveRegion="polite">
              {he.addItem.duplicate(duplicate.name, duplicate.list)}
            </Text>
            <View style={styles.duplicateActions}>
              {onOpen && (
                <PillButton
                  label={he.addItem.openExisting}
                  size="sm"
                  variant="quiet"
                  onPress={() => onOpen(duplicate.id)}
                  {...testId('item-form-open-existing')}
                />
              )}
              <PillButton
                label={he.addItem.addAnyway}
                size="sm"
                variant="quiet"
                onPress={() => submit(true)}
                {...testId('item-form-add-anyway')}
              />
            </View>
          </View>
        )}
        {match && (
          <View style={styles.match} {...testId('item-form-match')}>
            <Icon name="check" size={16} color={colors.primaryStrong} strokeWidth={2.5} />
            <Text style={styles.matchText} numberOfLines={1}>
              {he.addItem.fromCatalog(
                match.name,
                // The category it goes in: a category picked first keeps it.
                picked === NEW
                  ? shown.newName.trim()
                  : (categories.find((c) => c.id === picked)?.name ?? he.trip.uncategorized),
              )}
            </Text>
          </View>
        )}
        {!item && <AddManyLinks tripId={tripId} list={list} text={name} />}
        {!item && <CatalogPicker query={name} list={list} exclude={taken} onPick={pick} />}
      </View>

      {byAmount ? (
        <BuyAmountField
          value={buyAmount}
          error={displayQty === undefined ? buyAmountError(buyAmount) : undefined}
          onChange={setBuyAmount}
          onSubmitEditing={() => submit()}
        />
      ) : (
        <View style={styles.field}>
          <Text style={fieldStyles.label}>{he.addItem.howMany}</Text>
          <View
            style={styles.kinds}
            accessibilityRole="radiogroup"
            accessibilityLabel={he.addItem.howMany}
          >
            {KINDS.map((k) => {
              const selected = k === shown.kind;
              const [label, hint] = he.addItem.kinds[k];
              return (
                <Pressable
                  key={k}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => choose(setKind)(k)}
                  style={[styles.kind, selected && styles.kindOn]}
                >
                  <Text style={styles.kindLabel}>{label}</Text>
                  <Text style={styles.kindHint}>{hint}</Text>
                </Pressable>
              );
            })}
          </View>
          {shown.kind === 'qty' && (
            <View style={styles.qtyRow}>
              <Text style={styles.qtyLabel}>{he.addItem.total}</Text>
              <View style={styles.qtyControls}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={he.addItem.more}
                  onPress={() => choose(setQty)(shown.qty + 1)}
                  style={styles.qtyButton}
                >
                  <Icon name="plus" size={20} />
                </Pressable>
                <Text style={styles.qtyValue}>{shown.qty}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={he.addItem.less}
                  disabled={shown.qty <= 2}
                  onPress={() => choose(setQty)(shown.qty - 1)}
                  style={[styles.qtyButton, shown.qty <= 2 && { opacity: 0.35 }]}
                >
                  <Icon name="minus" size={20} />
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}

      <View style={styles.field}>
        <Text style={fieldStyles.label}>{he.addItem.category}</Text>
        <ChipGroup label={he.addItem.category}>
          {categories.map((c) => (
            <FilterChip
              key={c.id}
              label={c.name}
              selected={c.id === picked}
              onPress={() => choose(setCategory)(c.id)}
            />
          ))}
          <FilterChip
            label={he.trip.uncategorized}
            selected={picked === undefined}
            onPress={() => choose(setCategory)(undefined)}
          />
          <FilterChip
            label={`+ ${he.addItem.newCategory}`}
            selected={picked === NEW}
            onPress={() => choose(setCategory)(NEW)}
          />
        </ChipGroup>
        {picked === NEW && (
          <Input
            value={shown.newName}
            onChangeText={choose(setNewName)}
            placeholder={he.category.placeholder}
            accessibilityLabel={he.category.name}
            maxLength={40}
            // Picked by hand, not filled in by a typed catalog name: typing goes on in the name.
            autoFocus={category === NEW}
            style={styles.input}
          />
        )}
      </View>

      {!item && (
        // The whole row toggles; the switch stays the one control screen readers and Tab reach
        // (`tabIndex`: on web, `focusable={false}` still leaves the row a tab stop).
        <Pressable
          onPress={() => setClaim(!claim)}
          accessible={false}
          tabIndex={-1}
          style={styles.switchRow}
          {...testId('item-form-claim-row')}
        >
          <Text style={styles.switchLabel}>{claimLabel}</Text>
          <Switch value={claim} onChange={setClaim} label={claimLabel} />
        </Pressable>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  field: { gap: 10 },
  duplicate: { gap: 6 },
  duplicateActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  match: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6 },
  matchText: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.inkMuted },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  counter: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted, marginStart: 'auto' },
  input: {
    minHeight: 60,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: colors.ground,
    fontFamily: fonts.regular,
    fontSize: 19,
    color: colors.ink,
  },
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
