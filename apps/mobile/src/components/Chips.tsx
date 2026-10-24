import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, type AvatarPerson } from './Avatar';

import { colors, type } from '@/theme';

/** Filter / choice chip with an optional count (`הכול 20`): solid primary when selected, tonal otherwise. */
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
  const color = selected ? colors.onPrimary : colors.primaryStrong;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.primaryTint }]}
    >
      <Text style={[type.buttonSm, { color }]}>{label}</Text>
      {count !== undefined && <Text style={[styles.count, { color }]}>{count}</Text>}
    </Pressable>
  );
}

/** Person toggle chip (who shares an expense). */
export function PersonChip({
  person,
  name,
  selected,
  onPress,
}: {
  person: AvatarPerson;
  name: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[
        styles.chip,
        styles.person,
        { backgroundColor: selected ? colors.primaryTint : colors.ground },
      ]}
    >
      <Avatar person={person} ring={false} dimmed={!selected} />
      <Text style={[type.buttonSm, { color: selected ? colors.primaryStrong : colors.inkMuted }]}>
        {name}
      </Text>
    </Pressable>
  );
}

/** Quick-fill chip, with a leading "+" unless `plus={false}`. Sits on a card. */
export function SuggestionChip({
  label,
  onPress,
  plus = true,
}: {
  label: string;
  onPress: () => void;
  plus?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.chip, styles.suggestion]}
    >
      {plus && <Text style={[type.buttonSm, styles.plus]}>+</Text>}
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
  count: { ...type.caption, opacity: 0.8 },
  person: { paddingStart: 6 },
  suggestion: { maxWidth: 220, backgroundColor: colors.ground },
  plus: { color: colors.inkMuted },
  suggestionLabel: { flexShrink: 1, color: colors.ink },
});
