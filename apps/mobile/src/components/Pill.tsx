import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from './Icon';

import { colors, radius, space, type } from '@/theme';

type Tone = 'neutral' | 'primary' | 'brand' | 'onCover';

const TONES: Record<Tone, { bg: string; fg: string; border?: string }> = {
  neutral: { bg: colors.ground, fg: colors.ink },
  primary: { bg: colors.primaryTint, fg: colors.primaryStrong },
  /** "אצלך": orange text needs `card` under it, so it gets a hairline instead of a fill. */
  brand: { bg: colors.card, fg: colors.brandStrong, border: colors.line },
  onCover: { bg: colors.card, fg: colors.ink },
};

/** A badge, not a button: a count or a state ("חסרים 13", "אצלך 2", "עוד 14 ימים"). */
export function Pill({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: Tone;
  icon?: IconName;
}) {
  const t = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg, borderColor: t.border ?? t.bg }]}>
      {icon && <Icon name={icon} size={16} color={t.fg} strokeWidth={2.5} />}
      <Text style={[styles.label, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space[1],
    minHeight: 28,
    paddingHorizontal: space[3],
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  label: { ...type.buttonSm, fontFamily: type.stat.fontFamily, fontVariant: ['tabular-nums'] },
});
