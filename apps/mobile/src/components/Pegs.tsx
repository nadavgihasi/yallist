import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

/** Segmented progress: one segment per item, done first. */
export function Pegs({
  done,
  total,
  height = 10,
}: {
  done: number;
  total: number;
  height?: number;
}) {
  if (total === 0) return null;
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.peg,
            {
              height,
              borderRadius: height / 2,
              backgroundColor: i < done ? colors.accent : colors.missingPeg,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 3 },
  peg: { flex: 1 },
});
