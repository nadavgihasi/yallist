import { QUICK_SUGGESTIONS, filterItems, type ListFilter, type ListKind } from '@yallist/domain';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FilterChip, SuggestionChip } from '@/components/Chips';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { he } from '@/i18n/he';
import { useTripAction } from '@/state/trips';
import type { TripData } from '@/state/types';
import { colors, space, type } from '@/theme';

import type { TripView } from './derive';
import { ItemRow } from './ItemRow';
import { groupSummary } from './labels';
import { ShopBanner } from './ShopBanner';

const FILTERS: ListFilter[] = ['all', 'missing', 'mine'];

/** One list (bring or buy) by category. The trip screen owns `filter`, so the hero can set it. */
export function ListTab({
  list,
  data,
  view,
  me,
  filter,
  onFilter,
}: {
  list: ListKind;
  data: TripData;
  view: TripView;
  me: string;
  filter: ListFilter;
  onFilter: (filter: ListFilter) => void;
}) {
  const tripId = data.trip.id;
  const act = useTripAction(tripId);
  const listItems = view.items.filter((i) => i.list === list);
  const shown = (f: ListFilter) =>
    filterItems(listItems, f, data.claims, data.expenses, view.activeIds, me);
  const visible = new Set(shown(filter).map((i) => i.id));

  // The list's categories in order, then uncategorized items. Empty categories show under "all",
  // so there's somewhere to add the first item.
  const categories = data.categories
    .filter((c) => c.list === list)
    .sort((a, b) => a.position - b.position);
  const known = new Set(categories.map((c) => c.id));
  const groups = [...categories, undefined]
    .map((category) => {
      const all = listItems.filter((i) =>
        category ? i.categoryId === category.id : !i.categoryId || !known.has(i.categoryId),
      );
      return {
        category,
        total: all.length,
        missing: all.filter((i) => !view.done(i)).length,
        items: all.filter((i) => visible.has(i.id)),
      };
    })
    .filter((g) => g.items.length > 0 || (g.category && filter === 'all'));

  const addItem = (categoryId: string) =>
    router.push({ pathname: '/trips/[tripId]/items/new', params: { tripId, list, categoryId } });
  const editCategory = (categoryId: string) =>
    router.push({
      pathname: '/trips/[tripId]/categories/[categoryId]',
      params: { tripId, categoryId },
    });

  return (
    <View style={styles.wrap}>
      {list === 'buy' && <ShopBanner data={data} view={view} me={me} />}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        accessibilityRole="radiogroup"
      >
        {FILTERS.map((f) => (
          <FilterChip
            key={f}
            label={he.trip.filters[f]}
            count={shown(f).length}
            selected={filter === f}
            onPress={() => onFilter(f)}
          />
        ))}
      </ScrollView>
      {groups.length === 0 &&
        (filter === 'all' ? (
          // A new blank list: one tap adds a common item.
          <EmptyState {...he.trip.empty.all}>
            <View style={styles.chips}>
              {QUICK_SUGGESTIONS[list].map((name) => (
                <SuggestionChip
                  key={name}
                  label={name}
                  onPress={() =>
                    act({
                      type: 'addItem',
                      item: { list, name, kind: 'single', quantityNeeded: 1, categoryId: null },
                      claim: 0,
                    })
                  }
                />
              ))}
            </View>
          </EmptyState>
        ) : filter === 'mine' ? (
          <EmptyState
            spot={data.trip.cover}
            {...he.trip.empty[list === 'buy' ? 'mineBuy' : 'mine']}
            actions={
              view.missingIn(list) > 0
                ? [{ label: he.trip.empty.toMissing, onPress: () => onFilter('missing') }]
                : undefined
            }
          />
        ) : (
          <EmptyState {...he.trip.empty.missing} />
        ))}
      {groups.map(({ category, total, missing, items }) => (
        <Card key={category?.id ?? 'none'} gap={space[3]}>
          {/* The card's small muted title (trip.html "ציוד"), with ✎ for the category sheet. */}
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {category?.name ?? he.trip.uncategorized}
            </Text>
            {total > 0 && <Text style={styles.aside}>{groupSummary(missing)}</Text>}
            {category && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={he.trip.editCategory(category.name)}
                onPress={() => editCategory(category.id)}
                hitSlop={4} // 36px circle, 44px target
                style={styles.edit}
              >
                <Icon name="pencil" size={18} color={colors.primaryStrong} />
              </Pressable>
            )}
          </View>
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              claims={data.claims}
              view={view}
              me={me}
              onOpen={() =>
                router.push({
                  pathname: '/trips/[tripId]/items/[itemId]',
                  params: { tripId, itemId: item.id },
                })
              }
              onClaim={(quantity) => act({ type: 'setClaim', itemId: item.id, quantity })}
            />
          ))}
          {category && filter === 'all' && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={he.trip.addToCategoryLabel(category.name)}
              onPress={() => addItem(category.id)}
              style={styles.addRow}
            >
              <View style={styles.addRing}>
                <Icon name="plus" size={16} color={colors.primaryStrong} strokeWidth={2.5} />
              </View>
              <Text style={styles.addText}>{he.trip.addToCategory}</Text>
            </Pressable>
          )}
        </Card>
      ))}
      {filter === 'all' && (
        <PillButton
          label={he.trip.addCategory}
          variant="card"
          icon={<Icon name="plus" size={18} color={colors.ink} />}
          onPress={() =>
            router.push({ pathname: '/trips/[tripId]/categories/new', params: { tripId, list } })
          }
          style={styles.addCategory}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[4] },
  filters: { gap: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space[2] },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 36 },
  title: {
    ...type.caption,
    fontFamily: type.itemTitle.fontFamily,
    color: colors.inkMuted,
    flex: 1,
  },
  aside: { ...type.caption, color: colors.inkMuted },
  edit: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Lines up with the item rings above it.
  addRow: { minHeight: space.touch, flexDirection: 'row', alignItems: 'center', gap: space[3] },
  addRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { ...type.buttonSm, color: colors.primaryStrong },
  addCategory: { alignSelf: 'flex-start' },
});
