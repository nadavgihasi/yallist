import { filterItems, type ListFilter, type ListKind } from '@yallist/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FilterChip } from '@/components/Chips';
import { Icon } from '@/components/Icon';
import { EmptyState, ListGroup, SectionHeader } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { he } from '@/i18n/he';
import { useTripAction } from '@/state/trips';
import type { TripData } from '@/state/types';
import { colors, fonts } from '@/theme';

import type { TripView } from './derive';
import { ItemRow } from './ItemRow';
import { groupSummary } from './labels';

const FILTERS: ListFilter[] = ['all', 'missing', 'mine'];

export function ListTab({
  list,
  data,
  view,
  me,
}: {
  list: ListKind;
  data: TripData;
  view: TripView;
  me: string;
}) {
  const tripId = data.trip.id;
  const act = useTripAction(tripId);
  const [filter, setFilter] = useState<ListFilter>('all');
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
            onPress={() => setFilter(f)}
          />
        ))}
      </ScrollView>
      {groups.length === 0 && (
        <View style={styles.group}>
          <EmptyState title={he.trip.empty[filter].title} text={he.trip.empty[filter].text} />
        </View>
      )}
      {groups.map(({ category, total, missing, items }) => {
        const summary = groupSummary(missing);
        const title = category?.name ?? he.trip.uncategorized;
        return (
          <View key={category?.id ?? 'none'} style={styles.group}>
            <View style={styles.header}>
              <View style={styles.headerTitle}>
                <SectionHeader
                  title={title}
                  aside={total > 0 ? summary.text : undefined}
                  asideColor={summary.color}
                />
              </View>
              {category && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={he.trip.editCategory(category.name)}
                  onPress={() => editCategory(category.id)}
                  style={styles.headerButton}
                >
                  <Icon name="pencil" size={18} color={colors.inkSecondary} />
                </Pressable>
              )}
            </View>
            <ListGroup>
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
                  onPress={() => addItem(category.id)}
                  style={styles.addRow}
                >
                  <Icon name="plus" size={18} color={colors.accent} />
                  <Text style={styles.addText}>{he.trip.addToCategory}</Text>
                </Pressable>
              )}
            </ListGroup>
          </View>
        );
      })}
      {filter === 'all' && (
        <View style={styles.group}>
          <PillButton
            label={he.trip.addCategory}
            variant="outline"
            icon={<Icon name="plus" size={18} />}
            onPress={() =>
              router.push({ pathname: '/trips/[tripId]/categories/new', params: { tripId, list } })
            }
            style={styles.addCategory}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 20, gap: 24 },
  filters: { gap: 8, paddingHorizontal: 16 },
  group: { gap: 10, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerTitle: { flex: 1 },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addText: { fontFamily: fonts.medium, fontSize: 15, color: colors.accent },
  addCategory: { alignSelf: 'flex-start' },
});
