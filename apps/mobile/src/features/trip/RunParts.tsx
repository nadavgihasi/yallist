import { parseShekel } from '@yallist/domain';
import { StyleSheet, Text, View } from 'react-native';

import { AmountField, TextField } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { colors, radius, space, type } from '@/theme';

import type { TripView } from './derive';
import { newPart, type PartDraft } from './runSplit';
import { SharePicker } from './SharePicker';

/**
 * The checkout's parts: amounts of the total split between other people than the rest, such as
 * the alcohol for the drinkers only. Each has a name, an amount and its own people.
 */
export function RunParts({
  view,
  parts,
  onChange,
}: {
  view: TripView;
  parts: PartDraft[];
  onChange: (parts: PartDraft[]) => void;
}) {
  const update = (i: number, change: Partial<PartDraft>) =>
    onChange(parts.map((p, j) => (j === i ? { ...p, ...change } : p)));
  return (
    <>
      {parts.map((part, i) => (
        <View key={i} style={styles.part}>
          <TextField
            label={he.shop.finish.partName}
            value={part.label}
            onChangeText={(label) => update(i, { label })}
            placeholder={he.shop.finish.partPlaceholder}
            maxLength={40}
            {...testId(`shop-part-label-${i}`)}
          />
          <AmountField
            label={he.shop.finish.partAmount}
            value={part.amount}
            onChangeText={(amount) => update(i, { amount })}
            testID={`shop-part-amount-${i}`}
            error={part.amount.trim() && !parseShekel(part.amount) ? he.invalidAmount : undefined}
          />
          <SharePicker
            view={view}
            shares={part.shares}
            onChange={(shares) => update(i, { shares })}
            amount={parseShekel(part.amount)}
            showHint={false}
          />
          <PillButton
            label={he.shop.finish.removePart}
            variant="quiet"
            size="sm"
            icon={<Icon name="trash" size={16} color={colors.inkMuted} />}
            onPress={() => onChange(parts.filter((_, j) => j !== i))}
          />
        </View>
      ))}
      <View style={styles.add}>
        <PillButton
          label={he.shop.finish.addPart}
          variant="soft"
          wide
          icon={<Icon name="plus" size={18} color={colors.primaryStrong} />}
          onPress={() => onChange([...parts, newPart(view.activeIds)])}
          {...testId('shop-finish-add-part')}
        />
        {parts.length === 0 && <Text style={styles.hint}>{he.shop.finish.addPartHint}</Text>}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  part: {
    gap: space[3],
    padding: space[3],
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.line,
  },
  add: { gap: space[1] },
  hint: { ...type.caption, color: colors.inkMuted, textAlign: 'center' },
});
