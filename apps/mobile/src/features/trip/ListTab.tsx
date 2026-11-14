import {
  QUICK_SUGGESTIONS,
  filterItems,
  listProgress,
  type Item,
  type ListFilter,
  type ListKind,
} from '@yallist/domain';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FilterChip, SuggestionChip } from '@/components/Chips';
import { SubTabs } from '@/components/Controls';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { Progress } from '@/components/Progress';
import { he, packedCount } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useBag } from '@/state/bag';
import { useTripAction } from '@/state/trips';
import type { TripData } from '@/state/types';
import { accentAt, colors, space, type } from '@/theme';
import { useBreakpoint } from '@/theme/breakpoint';

import { BagCards } from './BagCards';
import { CopyFromTripButton } from './bulk/AddManyLinks';
import type { TripView } from './derive';
import { ItemRow } from './ItemRow';
import { itemKey } from './reveal';
import { RevealTarget } from './RevealTarget';
import { groupSummary } from './labels';
import { BRING_PARTS, myItems, myPackedCount, sharedItems, type BringPart } from './parts';
import { ShopBanner } from './ShopBanner';

const FILTERS: ListFilter[] = ['all', 'missing', 'mine'];
/** The shared equipment has no "אצלי": my own list is the view beside it. */
const SHARED_FILTERS: ListFilter[] = ['all', 'missing'];

/**
 * One list (bring or buy) by category. The bring list has two views (`part`): what the group
 * shares, and my own list, every "each" item and the shared ones I took, to pack. The trip
 * screen owns `filter` and `part`, so the hero can set them.
 */
export function ListTab({
  list,
  part = 'shared',
  data,
  view,
  me,
  filter: listFilter,
  onFilter,
  onPart,
}: {
  list: ListKind;
  part?: BringPart;
  data: TripData;
  view: TripView;
  me: string;
  filter: ListFilter;
  onFilter: (filter: ListFilter) => void;
  onPart?: (part: BringPart) => void;
}) {
  const tripId = data.trip.id;
  const act = useTripAction(tripId);
  // Only the bring list: there's nothing to buy of what's already at home.
  const bag = useBag().data ?? [];
  // Phone and tablet: a little tighter, as the trip screen around it, so the list starts higher.
  const tight = useBreakpoint() !== 'desktop';
  const listItems = view.items.filter((i) => i.list === list);
  const bring = list === 'bring';
  const mineView = bring && part === 'mine';
  const shared = sharedItems(listItems);
  const mine = myItems(listItems, data.claims, me);
  // What this view lists, before its filter.
  const scope = !bring ? listItems : mineView ? mine : shared;
  // My list is short and all mine: no filters. A filter the view lacks shows everything.
  const filters = mineView ? [] : bring ? SHARED_FILTERS : FILTERS;
  const filter = filters.includes(listFilter) ? listFilter : 'all';
  const shown = (f: ListFilter) =>
    filterItems(scope, f, data.claims, data.expenses, view.activeIds, me);
  const visible = new Set(shown(filter).map((i) => i.id));
  const sharedMissing = shared.filter((i) => !view.done(i)).length;

  // The list's categories in order, then uncategorized items. Empty categories show under "all",
  // so there's somewhere to add the first item; one with only another view's items doesn't.
  const categories = data.categories
    .filter((c) => c.list === list)
    .sort((a, b) => a.position - b.position);
  const known = new Set(categories.map((c) => c.id));
  const groups = [...categories, undefined]
    .map((category) => {
      const inGroup = (i: Item) =>
        category ? i.categoryId === category.id : !i.categoryId || !known.has(i.categoryId);
      const all = scope.filter(inGroup);
      return {
        category,
        empty: !listItems.some(inGroup),
        total: all.length,
        missing: all.filter((i) => !view.done(i)).length,
        items: all.filter((i) => visible.has(i.id)),
      };
    })
    .filter((g) => g.items.length > 0 || (g.category && g.empty && filter === 'all' && !mineView));

  const addItem = (categoryId: string) =>
    router.push({ pathname: '/trips/[tripId]/items/new', params: { tripId, list, categoryId } });
  const editCategory = (categoryId: string) =>
    router.push({
      pathname: '/trips/[tripId]/categories/[categoryId]',
      params: { tripId, categoryId },
    });

  const progress = bring && !mineView && listProgress(scope, data.claims, view.activeIds);
  const packed = mineView ? myPackedCount(mine, data.claims, me) : 0;
  // Adding goes on the shared view: my list only shows what's already there.
  const adds = filter === 'all' && !mineView;

  return (
    <View style={[styles.wrap, tight && styles.wrapTight]}>
      {bring && onPart && (
        <SubTabs
          options={BRING_PARTS.map((p) => ({
            value: p,
            label: he.trip.tabCount(he.trip.parts[p], (p === 'mine' ? mine : shared).length),
          }))}
          value={part}
          onChange={onPart}
          testID="trip-part"
        />
      )}
      {list === 'buy' && <ShopBanner data={data} view={view} me={me} />}
      {mineView && <BagCards data={data} view={view} me={me} bag={bag} />}
      {mineView && mine.length > 0 && (
        <View style={styles.progressWrap}>
          <Text style={styles.progress} {...testId('mine-packed')}>
            {he.trip.minePacked(packed, mine.length)}
          </Text>
          <Progress done={packed} total={mine.length} />
        </View>
      )}
      {progress && progress.total > 0 && (
        // Slim, not a card: the list starts right under it.
        <View style={styles.progressWrap}>
          <View style={styles.progressLine}>
            <Text style={styles.progress} {...testId('bring-progress')}>
              {he.trip.coveredCount(progress.covered, progress.total)}
            </Text>
            <Text style={styles.aside} {...testId('bring-packed')}>
              {packedCount(progress.packed)}
            </Text>
          </View>
          <Progress done={progress.covered} total={progress.total} />
        </View>
      )}
      {filters.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          accessibilityRole="radiogroup"
        >
          {filters.map((f) => (
            <FilterChip
              key={f}
              label={he.trip.filters[f]}
              count={shown(f).length}
              selected={filter === f}
              onPress={() => onFilter(f)}
            />
          ))}
        </ScrollView>
      )}
      {groups.length === 0 &&
        (mineView ? (
          <EmptyState
            spot={data.trip.cover}
            {...he.trip.empty.mineList}
            actions={
              sharedMissing > 0
                ? [
                    {
                      label: he.trip.empty.toMissing,
                      onPress: () => {
                        onPart?.('shared');
                        onFilter('missing');
                      },
                    },
                  ]
                : undefined
            }
          />
        ) : filter === 'all' ? (
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
            <CopyFromTripButton tripId={tripId} />
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
      {groups.map(({ category, total, missing, items }, index) => (
        <Card key={category?.id ?? 'none'} gap={space[3]}>
          {/* The card's small muted title (trip.html "ציוד"), with ✎ for the category sheet. */}
          <View style={styles.header}>
            <View style={[styles.dot, { backgroundColor: accentAt(index) }]} />
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
            <RevealTarget key={item.id} id={itemKey(item.list, item.name)}>
              <ItemRow
                item={item}
                claims={data.claims}
                view={view}
                me={me}
                bag={list === 'bring' ? bag : undefined}
                onOpen={() =>
                  router.push({
                    pathname: '/trips/[tripId]/items/[itemId]',
                    params: { tripId, itemId: item.id },
                  })
                }
                onOpenExpense={(expenseId) =>
                  router.push({
                    pathname: '/trips/[tripId]/expenses/[expenseId]',
                    params: { tripId, expenseId },
                  })
                }
                onClaim={(quantity) => act({ type: 'setClaim', itemId: item.id, quantity })}
                onPack={(packed) => act({ type: 'setPacked', itemId: item.id, packed })}
                accent={accentAt(index)}
              />
            </RevealTarget>
          ))}
          {category && adds && (
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
      {adds && (
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
  wrapTight: { gap: space[3] },
  filters: { gap: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space[2] },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 36 },
  // The category's accent, which its items' icons share.
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { ...type.itemTitle, color: colors.ink, flex: 1 },
  aside: { ...type.caption, color: colors.inkMuted },
  progress: { ...type.itemTitle, color: colors.ink, flex: 1 },
  progressWrap: { gap: space[2], paddingHorizontal: space[1] },
  progressLine: { flexDirection: 'row', alignItems: 'baseline', gap: space[3] },
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
