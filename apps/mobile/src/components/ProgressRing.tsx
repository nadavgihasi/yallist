import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Icon } from './Icon';

import { he } from '@/i18n/he';
import { ltr } from '@/lib/bidi';
import { colors, motion, progress, size as sizes, type } from '@/theme';

// `strokeDashoffset` isn't a native-driver prop, so this animates on the JS thread (and on web).
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Orange ring on a `line` track, filling clockwise from 12 o'clock (clocks don't mirror in RTL),
 * with "3/16" inside; a check once everything is covered. Animates when the count changes.
 */
export function ProgressRing({
  done,
  total,
  size = 'card',
}: {
  done: number;
  total: number;
  size?: 'hero' | 'card';
}) {
  const d = sizes.ring[size];
  const stroke = size === 'hero' ? 8 : 6;
  const r = (d - stroke) / 2;
  const length = 2 * Math.PI * r;
  const fraction = total > 0 ? Math.min(done / total, 1) : 0;
  const full = total > 0 && done >= total;
  const count = `${done}/${total}`;

  const [shown] = useState(() => new Animated.Value(fraction));
  useEffect(() => {
    Animated.timing(shown, {
      toValue: fraction,
      duration: motion.base,
      easing: Easing.bezier(...motion.easing.out),
      useNativeDriver: false,
    }).start();
  }, [shown, fraction]);

  return (
    <View
      style={[styles.ring, { width: d, height: d }]}
      accessibilityRole="progressbar"
      accessibilityLabel={he.trip.coveredOf(done, total)}
      accessibilityValue={{ min: 0, max: total, now: done }}
    >
      <Svg width={d} height={d} style={StyleSheet.absoluteFill}>
        <Circle
          cx={d / 2}
          cy={d / 2}
          r={r}
          stroke={progress.track}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={d / 2}
          cy={d / 2}
          r={r}
          stroke={progress.fill}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={length}
          strokeDashoffset={shown.interpolate({ inputRange: [0, 1], outputRange: [length, 0] })}
          // A round cap would draw a dot at 0%.
          strokeLinecap={fraction > 0 ? 'round' : 'butt'}
          transform={`rotate(-90 ${d / 2} ${d / 2})`}
        />
        {full && <Circle cx={d / 2} cy={d / 2} r={r - stroke} fill={progress.fill} />}
      </Svg>
      {full ? (
        <Icon name="check" size={d * 0.4} color={colors.onPrimary} strokeWidth={3} />
      ) : (
        <Text
          style={[styles.count, { fontSize: size === 'hero' ? 18 : count.length > 4 ? 12 : 15 }]}
        >
          {ltr(count)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center' },
  count: { ...type.stat, lineHeight: undefined, color: colors.ink },
});
