import { StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '@/theme';

/** A big value over its label ("₪180" / "הוצאות בטיול"); a row of them goes in a plain `Card`. */
export function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.value} maxFontSizeMultiplier={1.3}>
        {value}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: { gap: space[1] },
  value: { ...type.stat, color: colors.ink },
  label: { ...type.caption, color: colors.inkMuted },
});
