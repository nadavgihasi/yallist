import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, space, surface, type } from '@/theme';

/** The white card: the only container. A hairline outline, no shadow, never nested. */
export function Card({
  children,
  gap = space[4],
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  return (
    <View style={[styles.card, { gap }, style]} accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
}

/** A card of rows under a small muted title (trip.html "ציוד"); rows are spaced, not divided. */
export function ListGroup({
  title,
  aside,
  children,
  style,
}: {
  title?: string;
  aside?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Card gap={space[3]} style={style}>
      {title && (
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          {aside && <Text style={styles.aside}>{aside}</Text>}
        </View>
      )}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { ...surface, padding: space[5] },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[3],
  },
  title: { ...type.label, color: colors.inkMuted },
  aside: { ...type.caption, color: colors.inkMuted },
});
