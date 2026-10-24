import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, shadow, size as sizes, type } from '@/theme';

type Variant = 'solid' | 'soft' | 'quiet' | 'card' | 'danger';

/** solid = primary, soft = tonal (primaryTint), quiet = gray, card = white on the page, danger = text only. */
const VARIANTS: Record<Variant, { bg: string; fg: string }> = {
  solid: { bg: colors.primary, fg: colors.onPrimary },
  soft: { bg: colors.primaryTint, fg: colors.primaryStrong },
  quiet: { bg: colors.ground, fg: colors.inkMuted },
  card: { bg: colors.card, fg: colors.ink },
  danger: { bg: 'transparent', fg: colors.brandStrong },
};

/** sm/md = `size-button-sm` (sm is tighter, for row chips), lg = `size-button-lg`. */
const SIZES = {
  sm: { height: sizes.buttonSm, padding: 16, text: type.buttonSm },
  md: { height: sizes.buttonSm, padding: 20, text: type.buttonSm },
  lg: { height: sizes.buttonLg, padding: 28, text: type.buttonLg },
} as const;

export function PillButton({
  label,
  variant = 'solid',
  size = 'md',
  icon,
  wide = false,
  float = false,
  disabled,
  style,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: Variant;
  size?: keyof typeof SIZES;
  /** Icon before the label (on the right in RTL), drawn in the label color. */
  icon?: ReactNode;
  wide?: boolean;
  /** The screen's one floating action: adds `shadow-float`. */
  float?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.pill,
        {
          minHeight: s.height,
          backgroundColor: v.bg,
          paddingHorizontal: s.padding,
          gap: size === 'lg' ? 16 : 8,
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        },
        wide && styles.wide,
        float && shadow.float,
        style,
      ]}
      {...rest}
    >
      {icon && <View>{icon}</View>}
      <Text style={[s.text, { color: v.fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Label color per variant, for icons passed to `PillButton`. */
export const pillColor = (variant: Variant) => VARIANTS[variant].fg;

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  wide: { alignSelf: 'stretch' },
});
