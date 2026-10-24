import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, type AvatarPerson } from './Avatar';

import { colors, fonts } from '@/theme';

/** Filter chip with a count (`הכול 20`). Dark when selected. */
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
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.chip, selected ? styles.dark : styles.light]}
    >
      <Text style={[styles.label, { color: selected ? colors.onPrimary : colors.ink }]}>
        {label}
      </Text>
      {count !== undefined && (
        <Text
          style={[styles.count, { color: selected ? 'rgba(255,255,255,0.75)' : colors.inkMuted }]}
        >
          {count}
        </Text>
      )}
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
        styles.person,
        selected
          ? { borderColor: colors.primary, backgroundColor: colors.primaryTint }
          : { borderColor: colors.line, backgroundColor: 'transparent' },
      ]}
    >
      <Avatar person={person} ring={false} dimmed={!selected} />
      <Text style={[styles.label, { color: selected ? colors.ink : colors.inkMuted }]}>{name}</Text>
    </Pressable>
  );
}

/** Outlined suggestion chip, with a leading "+" unless `plus={false}`. */
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
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.suggestion}>
      {plus && <Text style={styles.plus}>+</Text>}
      <Text style={styles.suggestionLabel} numberOfLines={1}>
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
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dark: { backgroundColor: colors.ink, borderColor: colors.ink },
  light: { backgroundColor: colors.card, borderColor: colors.line },
  label: { fontFamily: fonts.bold, fontSize: 15 },
  count: { fontFamily: fonts.bold, fontSize: 13 },
  person: {
    minHeight: 44,
    paddingStart: 6,
    paddingEnd: 14,
    borderRadius: 22,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  suggestion: {
    maxWidth: 220,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  plus: { fontFamily: fonts.bold, fontSize: 16, color: colors.inkMuted },
  suggestionLabel: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
});
