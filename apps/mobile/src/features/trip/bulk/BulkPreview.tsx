import type { BulkEntry, ListKind } from '@yallist/domain';
import { StyleSheet, Text, View } from 'react-native';

import { fieldStyles } from '@/components/Fields';
import { ItemIcon } from '@/components/ItemIcon';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { colors, space, type } from '@/theme';

import { bulkSummary } from './bulkState';

/** What a bulk add will do, before saving: each item as it'll be added, or why it won't be. */
export function BulkPreview({ entries, list }: { entries: readonly BulkEntry[]; list: ListKind }) {
  const summary = bulkSummary(entries);
  return (
    <View style={styles.wrap} {...testId('bulk-preview')}>
      <View style={styles.head}>
        <Text style={[fieldStyles.label, styles.flex]}>{he.bulk.preview}</Text>
        {entries.length > 0 && (
          <Text style={styles.caption} accessibilityLiveRegion="polite">
            {he.bulk.summary(summary.add, summary.exists)}
          </Text>
        )}
      </View>
      {entries.length === 0 ? (
        <Text style={styles.caption}>{he.bulk.previewEmpty}</Text>
      ) : (
        entries.map(({ item, status }, index) => {
          const skipped = status !== 'add';
          const details = [
            item.kind === 'qty'
              ? he.bulk.qty(item.quantityNeeded)
              : item.kind === 'each' && he.bulk.each,
            item.displayQty,
            item.category,
            item.list !== list && he.bulk.toList[item.list],
          ].filter(Boolean);
          return (
            <View key={`${index}/${item.name}`} style={styles.row}>
              <ItemIcon name={item.name} list={item.list} />
              <View style={styles.flex}>
                <Text style={[styles.name, skipped && styles.skipped]} numberOfLines={2}>
                  {item.name}
                </Text>
                {details.length > 0 && <Text style={styles.caption}>{details.join(' · ')}</Text>}
              </View>
              {skipped && <Text style={styles.status}>{he.bulk.status[status]}</Text>}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 44 },
  name: { ...type.itemTitle, color: colors.ink },
  skipped: { color: colors.inkFaint, textDecorationLine: 'line-through' },
  caption: { ...type.caption, color: colors.inkMuted },
  status: { ...type.caption, fontFamily: type.itemTitle.fontFamily, color: colors.brandStrong },
});
