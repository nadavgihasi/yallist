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
import { ItemIcon } from '@/components/ItemIcon';
import { he } from '@/i18n/he';
import { colors, radius, space, type } from '@/theme';

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
            <ItemIcon name={item.name} size={36} />
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
  const categories = CATALOG_CATEGORIES.filter((c) => c.list === list);
  const items = open ? catalogCategoryItems(open).filter((i) => !exclude.has(i.name)) : [];
  return (
    <View style={styles.browse}>
      <ChipGroup label={he.catalog.categories}>
        {categories.map((c) => (
          <FilterChip
            key={c.id}
            label={`${c.icon} ${c.name}`}
            selected={open === c.name}
            onPress={() => setOpen(open === c.name ? undefined : c.name)}
          />
        ))}
      </ChipGroup>
      {items.length > 0 && (
        <View style={styles.wrap}>
          {items.map((i) => (
            <SuggestionChip key={i.name} label={`${i.icon} ${i.name}`} onPress={() => onPick(i)} />
          ))}
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
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
