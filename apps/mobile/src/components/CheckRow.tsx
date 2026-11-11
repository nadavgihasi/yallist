import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';

import { colors, space, type } from '@/theme';

/** A row with a checkbox: the box, a name, and an optional muted detail at the end. */
export function CheckRow({
  label,
  detail,
  checked,
  onToggle,
  testID,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  onToggle: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={styles.row}
      testID={testID}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked && <Icon name="check" size={14} color={colors.onPrimary} strokeWidth={3.5} />}
      </View>
      <Text style={styles.name}>{label}</Text>
      {!!detail && <Text style={styles.detail}>{detail}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 48 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.inkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  name: { ...type.itemTitle, color: colors.ink, flex: 1 },
  detail: { ...type.caption, color: colors.inkMuted },
});
