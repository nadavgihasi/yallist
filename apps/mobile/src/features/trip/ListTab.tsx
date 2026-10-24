import { filterItems, type ListFilter, type ListKind } from '@yallist/domain';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { FilterChip } from '@/components/Chips';
import { EmptyState, ListGroup, SectionHeader } from '@/components/ListGroup';
import { he } from '@/i18n/he';
import { useDispatch } from '@/state/store';
import type { TripData } from '@/state/types';

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
  const dispatch = useDispatch();
  const [filter, setFilter] = useState<ListFilter>('all');
  const tripId = data.trip.id;
  const listItems = view.items.filter((i) => i.list === list);
  const shown = (f: ListFilter) =>
    filterItems(listItems, f, data.claims, data.expenses, view.activeIds, me);
  const visible = new Set(shown(filter).map((i) => i.id));

  const categories = [...new Set(listItems.map((i) => i.category))];
  const groups = categories
    .map((category) => {
      const all = listItems.filter((i) => i.category === category);
      return {
        category,
        missing: all.filter((i) => !view.done(i)).length,
        items: all.filter((i) => visible.has(i.id)),
      };
    })
    .filter((g) => g.items.length > 0);

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
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
        <EmptyState title={he.trip.empty[filter].title} text={he.trip.empty[filter].text} />
      )}
      {groups.map((g) => {
        const summary = groupSummary(g.missing);
        return (
          <View key={g.category} style={styles.group}>
            <SectionHeader title={g.category} aside={summary.text} asideColor={summary.color} />
            <ListGroup>
              {g.items.map((item) => (
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
                  onClaim={(quantity) =>
                    dispatch({ type: 'setClaim', tripId, itemId: item.id, userId: me, quantity })
                  }
                />
              ))}
            </ListGroup>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 20, gap: 24 },
  filters: { gap: 8, paddingHorizontal: 16 },
  group: { gap: 10, paddingHorizontal: 16 },
});
