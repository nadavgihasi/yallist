import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { colors, radius, space } from '@/theme';

/** Placeholder fill (`well`). */
const WELL = colors.ground;

/**
 * The shape of a screen while its data loads, pulsing (still under reduced motion). Labeled once
 * for screen readers, and `loading` for the UI tests to wait on its absence.
 */
function SkeletonRoot({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduced) return;
    const half = { duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true };
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { ...half, toValue: 0.55 }),
        Animated.timing(opacity, { ...half, toValue: 1 }),
      ]),
    );
    pulse.start();
    return () => {
      pulse.stop();
      opacity.setValue(1);
    };
  }, [reduced, opacity]);

  return (
    <Animated.View
      style={[style, { opacity }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={he.states.loading}
      {...testId('loading')}
    >
      {children}
    </Animated.View>
  );
}

/** A line of text; `width` as a share of the row. */
function Line({ width = '100%', height = 14 }: { width?: `${number}%`; height?: number }) {
  return <View style={{ width, height, borderRadius: height / 2, backgroundColor: WELL }} />;
}

function SkeletonCircle({ size }: { size: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: WELL }} />
  );
}

/** A white card, with a cover band of `cover` px on top. */
function SkeletonCard({
  cover,
  children,
  style,
}: {
  cover?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, style]}>
      {cover !== undefined && <View style={{ height: cover, backgroundColor: WELL }} />}
      {children && <View style={styles.body}>{children}</View>}
    </View>
  );
}

export const Skeleton = Object.assign(SkeletonRoot, {
  Line,
  Circle: SkeletonCircle,
  Card: SkeletonCard,
});

const styles = StyleSheet.create({
  card: { borderRadius: radius.card, backgroundColor: colors.card, overflow: 'hidden' },
  body: { padding: space[5], gap: space[3] },
});
