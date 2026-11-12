import { BULK_MAX_ITEMS, bulkToAdd, heldCatalogNames, type ListKind } from '@yallist/domain';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SegmentedControl } from '@/components/Controls';
import { Input, fieldStyles } from '@/components/Fields';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { showToast } from '@/components/Toast';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useBulkAdd } from '@/state/bulk';
import { useTrip } from '@/state/trips';
import { colors, fonts, space, type } from '@/theme';

import { useCloseSheet } from '../closeSheet';
import { CopyLink } from './AddManyLinks';
import { BulkPreview } from './BulkPreview';
import { bulkEntries, bulkSummary, togglePicked } from './bulkState';
import { SuggestionPicker } from './SuggestionPicker';

/**
 * Adding many items at once: typed or pasted lines, and suggestions ticked many at a time, with a
 * preview of what goes in. Saved in one request; the sheet closes once they're in, and stays open
 * with everything as it was if saving fails.
 */
export function BulkAddSheet({
  tripId,
  list: initialList,
  text: initialText = '',
}: {
  tripId: string;
  list: ListKind;
  text?: string;
}) {
  const data = useTrip(tripId);
  const close = useCloseSheet(tripId);
  const bulk = useBulkAdd(tripId);
  const [list, setList] = useState(initialList);
  const [text, setText] = useState(initialText);
  const [picked, setPicked] = useState<string[]>([]);
  // Set at once on the first tap, unlike `isPending`: a double tap sends one request.
  const sending = useRef(false);

  if (!data) return null;

  const entries = bulkEntries(text, picked, list, data.items);
  const summary = bulkSummary(entries);
  const held = heldCatalogNames(data.items.filter((i) => i.list === list).map((i) => i.name));
  const canSave = summary.add > 0 && !summary.tooMany && !bulk.isPending;

  const save = () => {
    if (!canSave || sending.current) return;
    sending.current = true;
    bulk.mutate(bulkToAdd(entries), {
      onSettled: () => {
        sending.current = false;
      },
      onSuccess: ({ added, skipped }) => {
        close();
        // The catalog may have put some on the other list: say so, as the preview did.
        const other = list === 'bring' ? 'buy' : 'bring';
        const elsewhere = added.filter((i) => i.list === other).length;
        showToast(
          he.bulk.added(added.length, summary.exists + skipped.length, {
            list: other,
            count: elsewhere,
          }),
        );
      },
      onError: () => showToast(he.bulk.failed, 'error'),
    });
  };

  return (
    <Sheet
      title={he.bulk.title}
      subtitle={he.bulk.subtitle}
      onClose={close}
      footer={
        <View style={styles.footer}>
          {summary.tooMany && (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {he.bulk.tooMany(BULK_MAX_ITEMS)}
            </Text>
          )}
          <PillButton
            label={he.bulk.cta(summary.add)}
            {...testId('bulk-save')}
            size="lg"
            wide
            disabled={!canSave}
            onPress={save}
          />
        </View>
      }
    >
      <SegmentedControl
        options={[
          { value: 'bring', label: he.trip.tabs.bring },
          { value: 'buy', label: he.trip.tabs.buy },
        ]}
        value={list}
        onChange={setList}
        style={{ backgroundColor: colors.ground }}
      />

      <View style={styles.field}>
        <Text style={fieldStyles.label}>{he.bulk.text}</Text>
        <Input
          value={text}
          onChangeText={setText}
          multiline
          textAlignVertical="top"
          placeholder={he.bulk.placeholder}
          accessibilityLabel={he.bulk.text}
          autoFocus
          {...testId('bulk-text')}
          style={styles.text}
        />
      </View>

      <SuggestionPicker
        list={list}
        picked={picked}
        held={held}
        onToggle={(name) => setPicked((p) => togglePicked(p, name))}
      />

      <BulkPreview entries={entries} list={list} />
      <CopyLink tripId={tripId} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  field: { gap: 10 },
  text: {
    minHeight: 140,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: colors.ground,
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 26,
    color: colors.ink,
  },
  footer: { gap: space[2] },
  error: {
    ...type.caption,
    fontFamily: fonts.bold,
    color: colors.brandStrong,
    textAlign: 'center',
  },
});
