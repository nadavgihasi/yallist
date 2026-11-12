import {
  CATALOG_CATEGORIES,
  QUICK_SUGGESTIONS,
  catalogCategoryItems,
  findCatalogItem,
  type ListKind,
} from '@yallist/domain';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChipGroup, FilterChip } from '@/components/Chips';
import { fieldStyles } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { ItemIcon } from '@/components/ItemIcon';
import { PillButton } from '@/components/PillButton';
import { he } from '@/i18n/he';
import { colors, type } from '@/theme';

import { isPicked } from './bulkState';

/** How many items of a category show at once; the rest come with "more". */
const PAGE = 24;

/**
 * The suggestions to tick, many at a time: the list's common items, and the catalog's items by
 * category (the same ones the one-item sheet suggests). What the list already has isn't offered.
 */
export function SuggestionPicker({
  list,
  picked,
  held,
  onToggle,
}: {
  list: ListKind;
  picked: readonly string[];
  /** Names the list already has, as `heldCatalogNames` gives them. */
  held: ReadonlySet<string>;
  onToggle: (name: string) => void;
}) {
  const [open, setOpen] = useState<string>();
  const [shown, setShown] = useState(PAGE);
  const offered = (name: string) =>
    !held.has(name) && !held.has(findCatalogItem(name)?.name ?? name);
  const common = QUICK_SUGGESTIONS[list].filter(offered);
  const categories = CATALOG_CATEGORIES.filter((c) => c.list === list);
  const items = open ? catalogCategoryItems(open).filter((i) => offered(i.name)) : [];

  return (
    <View style={styles.wrap}>
      <Text style={fieldStyles.label}>{he.bulk.suggestions}</Text>
      {common.length > 0 && (
        <View style={styles.chips} accessibilityLabel={he.bulk.common}>
          {common.map((name) => (
            <ToggleChip
              key={name}
              name={name}
              list={list}
              checked={isPicked(picked, name)}
              onToggle={onToggle}
            />
          ))}
        </View>
      )}
      <ChipGroup label={he.catalog.categories}>
        {categories.map((c) => (
          <FilterChip
            key={c.id}
            label={c.name}
            selected={open === c.name}
            onPress={() => {
              setOpen(open === c.name ? undefined : c.name);
              setShown(PAGE);
            }}
          />
        ))}
      </ChipGroup>
      {items.length > 0 && (
        <View style={styles.chips}>
          {items.slice(0, shown).map((i) => (
            <ToggleChip
              key={i.name}
              name={i.name}
              list={list}
              checked={isPicked(picked, i.name)}
              onToggle={onToggle}
            />
          ))}
          {items.length > shown && (
            <PillButton
              label={he.catalog.more(items.length - shown)}
              variant="quiet"
              size="sm"
              onPress={() => setShown(shown + PAGE)}
            />
          )}
        </View>
      )}
    </View>
  );
}

/** A suggestion that ticks on and off: a check when ticked, the item's icon otherwise. */
function ToggleChip({
  name,
  list,
  checked,
  onToggle,
}: {
  name: string;
  list: ListKind;
  checked: boolean;
  onToggle: (name: string) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={name}
      onPress={() => onToggle(name)}
      style={[styles.chip, checked && styles.chipOn]}
    >
      {checked ? (
        <Icon name="check" size={18} color={colors.onPrimary} strokeWidth={3} />
      ) : (
        <ItemIcon name={name} list={list} size={18} />
      )}
      <Text style={[styles.label, checked && styles.labelOn]} numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.ground,
  },
  chipOn: { backgroundColor: colors.primary },
  label: { ...type.buttonSm, color: colors.ink },
  labelOn: { color: colors.onPrimary },
});
