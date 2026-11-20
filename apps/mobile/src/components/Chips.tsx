import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, type AvatarPerson } from './Avatar';
import { Icon } from './Icon';

import { colors, type } from '@/theme';

/** Filter / choice chip with an optional count (`הכול 20`): solid violet when selected, an outlined card otherwise. */
export function FilterChip({
  label,
  count,
  selected,
  onPress,
}: {
  label: string;
  count?: number;
  selected: boolean;
  onPress: () => void;
}) {
  const color = selected ? colors.onPrimary : colors.ink;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.chip, styles.filter, selected && styles.filterOn]}
    >
      <Text style={[type.buttonSm, { color }]}>{label}</Text>
      {count !== undefined && (
        <Text style={[styles.count, { color: selected ? colors.onPrimary : colors.inkMuted }]}>
          {count}
        </Text>
      )}
    </Pressable>
  );
}

/** Person toggle chip (who shares an expense), with an optional count. A long name is cut short. */
export function PersonChip({
  person,
  name,
  count,
  selected,
  onPress,
}: {
  person: AvatarPerson;
  name: string;
  count?: number;
  selected: boolean;
  onPress: () => void;
}) {
  // Selected is a solid violet chip with a check, as selected chips are; left out, an outline.
  const color = selected ? colors.onPrimary : colors.inkMuted;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.chip, styles.person, selected ? styles.personOn : styles.personOff]}
    >
      <Avatar person={person} ring={false} dimmed={!selected} />
      <Text style={[type.buttonSm, styles.personName, { color }]} numberOfLines={1}>
        {name}
      </Text>
      {count !== undefined && <Text style={[type.buttonSm, { color }]}>({count})</Text>}
      {selected && <Icon name="check" size={16} color={colors.onPrimary} strokeWidth={3} />}
    </Pressable>
  );
}

/** Quick-fill chip, with a leading "+" unless `plus={false}`. Sits on a card. */
export function SuggestionChip({
  label,
  onPress,
  plus = true,
  icon,
}: {
  label: string;
  onPress: () => void;
  plus?: boolean;
  /** Shown before the label, in place of the "+". */
  icon?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, styles.suggestion]}
    >
      {icon ?? (plus && <Text style={[type.buttonSm, styles.plus]}>+</Text>)}
      <Text style={[type.buttonSm, styles.suggestionLabel]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Wraps radio chips so screen readers announce them as one choice. */
export function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filter: { borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.card },
  filterOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  count: { ...type.caption, fontVariant: ['tabular-nums'] },
  person: { paddingStart: 6, maxWidth: '100%', borderWidth: 1.5 },
  personOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  personOff: { backgroundColor: colors.card, borderColor: colors.line },
  personName: { flexShrink: 1 },
  suggestion: { maxWidth: 220, backgroundColor: colors.ground },
  plus: { color: colors.inkMuted },
  suggestionLabel: { flexShrink: 1, color: colors.ink },
});
