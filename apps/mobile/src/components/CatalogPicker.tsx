import {
  CATALOG_CATEGORIES,
  catalogCategoryItems,
  normalizeName,
  searchCatalog,
  type CatalogItem,
  type ListKind,
} from '@yallist/domain';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ChipGroup, FilterChip, SuggestionChip } from '@/components/Chips';
import { PillButton } from '@/components/PillButton';
import { ItemIcon } from '@/components/ItemIcon';
import { he } from '@/i18n/he';
import { colors, radius, space, type } from '@/theme';

/** How many items of a category show at once; the rest come with "more". */
const PAGE = 24;

/**
 * The categories shown before "more categories", by id: the ones most trips use, so the sheet
 * doesn't open on a wall of chips.
 */
const COMMON: Record<ListKind, string[]> = {
  bring: ['cooking', 'sleeping', 'seating', 'kitchen', 'clothes', 'hygiene'],
  buy: ['meat', 'bread', 'veg', 'drinks', 'snacks', 'breakfast'],
};

/**
 * The catalog under a name field. While something is typed: the items that match, to tap (the
 * name is then spelled as the catalog does, which is how a trip item meets my bag). Before that:
 * the catalog's categories, each opening its items.
 */
export function CatalogPicker({
  query,
  list,
  exclude,
  onPick,
  browse = true,
}: {
  query: string;
  /** The list being added to: its items come first, and only its categories are browsed. */
  list: ListKind;
  /** Names the list already has. */
  exclude: ReadonlySet<string>;
  onPick: (item: CatalogItem) => void;
  /** Whether the categories show when nothing is typed. */
  browse?: boolean;
}) {
  const [open, setOpen] = useState<string>();
  const [shown, setShown] = useState(PAGE);
  const [all, setAll] = useState(false);
  const typed = normalizeName(query).length > 0;

  if (typed) {
    const results = searchCatalog(query, { list, exclude });
    // The name is already the catalog's: nothing left to suggest.
    if (results.length === 0 || results.some((r) => normalizeName(r.name) === normalizeName(query)))
      return null;
    return (
      <View style={styles.results} accessibilityLabel={he.catalog.results}>
        {results.map((item) => (
          <Pressable
            key={item.name}
            accessibilityRole="button"
            accessibilityLabel={item.name}
            onPress={() => onPick(item)}
            style={styles.result}
          >
            <ItemIcon name={item.name} />
            <Text style={styles.resultName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.resultCategory} numberOfLines={1}>
              {item.category}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  if (!browse) return null;
  const listed = CATALOG_CATEGORIES.filter((c) => c.list === list);
  // A few common ones until asked for all; an opened one always stays in sight.
  const categories = all
    ? listed
    : listed.filter((c) => COMMON[list].includes(c.id) || c.name === open);
  const hidden = listed.length - categories.length;
  const items = open ? catalogCategoryItems(open).filter((i) => !exclude.has(i.name)) : [];
  return (
    <View style={styles.browse}>
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
      {(hidden > 0 || all) && (
        <PillButton
          label={all ? he.catalog.fewerCategories : he.catalog.moreCategories(hidden)}
          variant="quiet"
          size="sm"
          onPress={() => setAll(!all)}
          style={styles.toggle}
        />
      )}
      {items.length > 0 && (
        <View style={styles.wrap}>
          {items.slice(0, shown).map((i) => (
            <SuggestionChip
              key={i.name}
              label={i.name}
              icon={<ItemIcon name={i.name} size={18} />}
              onPress={() => onPick(i)}
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

const styles = StyleSheet.create({
  results: { borderRadius: radius.card, backgroundColor: colors.ground, padding: space[1] },
  result: {
    minHeight: space.touch + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[3],
    paddingVertical: space[1],
  },
  resultName: { ...type.itemTitle, color: colors.ink, flexShrink: 1 },
  resultCategory: { ...type.caption, color: colors.inkMuted, flex: 1 },
  browse: { gap: space[3] },
  toggle: { alignSelf: 'flex-start' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
