import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { colors, motion, space, type } from '@/theme';

// `strokeDashoffset` isn't a native-driver prop, so this animates on the JS thread (and on web).
const AnimatedPath = Animated.createAnimatedComponent(Path);
/** The Check-Y mark (docs/design/brand/logo/yallist-mark.svg), and its stroke's length. */
const MARK = 'M25 38 L43 56 L75 22 M43 56 L43 80';
const LENGTH = 97;

/**
 * Full-screen waits only (app boot, the join preview): nothing for 300ms, then the Check-Y
 * drawing itself on a loop, and after 2s one line of copy.
 */
export function Loader({ line }: { line: string }) {
  const [stage, setStage] = useState<'hidden' | 'mark' | 'line'>('hidden');
  useEffect(() => {
    const timers = [
      setTimeout(() => setStage('mark'), 300),
      setTimeout(() => setStage('line'), 2000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <View
      style={styles.screen}
      accessibilityRole="progressbar"
      accessibilityLabel={he.states.loading}
      {...testId('loading')}
    >
      {stage !== 'hidden' && <CheckY />}
      {stage === 'line' && (
        <Text style={styles.line} accessibilityLiveRegion="polite">
          {line}
        </Text>
      )}
    </View>
  );
}

/** Draws in, holds, starts over; drawn and still under reduced motion. */
function CheckY() {
  const reduced = useReducedMotion();
  const [drawn] = useState(() => new Animated.Value(reduced ? 1 : 0));
  useEffect(() => {
    if (reduced) return drawn.setValue(1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drawn, {
          toValue: 1,
          duration: 900,
          easing: Easing.bezier(...motion.easing.out),
          useNativeDriver: false,
        }),
        Animated.delay(motion.slow),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, drawn]);

  return (
    <Svg width={56} height={63} viewBox="18.5 15.5 63 71">
      <AnimatedPath
        d={MARK}
        fill="none"
        stroke={colors.brand}
        strokeWidth={13}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={LENGTH}
        strokeDashoffset={drawn.interpolate({ inputRange: [0, 1], outputRange: [LENGTH, 0] })}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
    backgroundColor: colors.ground,
  },
  line: { ...type.body, color: colors.inkMuted, textAlign: 'center' },
});
