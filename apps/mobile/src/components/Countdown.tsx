import { StyleSheet, Text } from 'react-native';

import { Pill } from './Pill';

import { countdown } from '@/lib/dates';
import { colors, type } from '@/theme';

/**
 * How long until the trip, or which day of it: `hero` as a stat, `inline` as a pill on a cover.
 * Pass `now` from `useToday()` so it rolls over at midnight.
 */
export function Countdown({
  startsOn,
  endsOn,
  now,
  variant = 'inline',
}: {
  startsOn: string;
  endsOn: string;
  now: string;
  variant?: 'hero' | 'inline';
}) {
  const { label } = countdown(startsOn, endsOn, now);
  if (variant === 'inline') return <Pill label={label} tone="onCover" icon="clock" />;
  return (
    <Text style={styles.hero} maxFontSizeMultiplier={1.3}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  hero: { ...type.stat, color: colors.ink },
});
