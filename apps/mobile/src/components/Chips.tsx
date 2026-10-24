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
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected ? styles.dark : styles.light]}
    >
      <Text style={[styles.label, { color: selected ? colors.white : colors.ink }]}>{label}</Text>
      {count !== undefined && (
        <Text
          style={[
            styles.count,
            { color: selected ? 'rgba(255,255,255,0.75)' : colors.inkSecondary },
          ]}
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
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.person,
        selected
          ? { borderColor: colors.accent, backgroundColor: colors.accentTint }
          : { borderColor: colors.borderPill, backgroundColor: 'transparent' },
      ]}
    >
      <Avatar person={person} ring={false} dimmed={!selected} />
      <Text style={[styles.label, { color: selected ? colors.ink : colors.inkSecondary }]}>
        {name}
      </Text>
    </Pressable>
  );
}

/** Outlined suggestion chip with a leading "+". */
export function SuggestionChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.suggestion}>
      <View>
        <Text style={styles.plus}>+</Text>
      </View>
      <Text style={styles.suggestionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  light: { backgroundColor: colors.white, borderColor: colors.borderChip },
  label: { fontFamily: fonts.medium, fontSize: 15 },
  count: { fontFamily: fonts.semibold, fontSize: 13 },
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
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.borderPill,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  plus: { fontFamily: fonts.medium, fontSize: 16, color: colors.inkSecondary },
  suggestionLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
});
