import { StyleSheet, Text, View } from 'react-native';

import { avatarSize, colors, fonts, type } from '@/theme';

export interface AvatarPerson {
  initial: string;
  /** Their pale avatar color (AVATAR_COLORS); without one, the `primary` badge. */
  color?: string;
}

/**
 * Initial badge: `primary` fill, `onPrimary` letter. `dimmed` for someone left out (share picker).
 * A pale avatar color (`color`, else the person's unless dimmed) fills it instead, with an `ink` letter.
 */
export function Avatar({
  person,
  size = avatarSize.md,
  ring = true,
  dimmed = false,
  color,
}: {
  person: AvatarPerson;
  size?: number;
  ring?: boolean;
  dimmed?: boolean;
  color?: string;
}) {
  const fill = color ?? (dimmed ? undefined : person.color);
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          backgroundColor: fill ?? (dimmed ? colors.primaryTint : colors.primary),
          borderWidth: ring ? 2 : 0,
        },
      ]}
    >
      <Text
        style={[
          styles.initial,
          {
            color: fill ? colors.ink : dimmed ? colors.primaryStrong : colors.onPrimary,
            fontSize: Math.round(size * 0.42),
          },
        ]}
      >
        {person.initial}
      </Text>
    </View>
  );
}

/**
 * Overlapping avatars with a "+N" bubble when there are more than `max`. `label` names them
 * ("דנה, אבי ונועה") beside the stack, which is also what a screen reader says.
 */
export function AvatarStack({
  people,
  max = 3,
  size = avatarSize.sm,
  label,
}: {
  people: AvatarPerson[];
  max?: number;
  size?: number;
  label?: string;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const stack = (
    <View style={styles.stack} importantForAccessibility={label ? 'no-hide-descendants' : 'auto'}>
      {shown.map((p, i) => (
        <View key={i} style={i > 0 && styles.overlap}>
          <Avatar person={p} size={size} />
        </View>
      ))}
      {extra > 0 && (
        <View style={[styles.avatar, styles.overlap, styles.more, { width: size, height: size }]}>
          <Text style={[styles.initial, styles.moreText, { fontSize: Math.round(size * 0.42) }]}>
            +{extra}
          </Text>
        </View>
      )}
    </View>
  );
  if (!label) return stack;
  return (
    <View style={styles.labelled}>
      {stack}
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderColor: colors.card,
  },
  initial: { fontFamily: fonts.extraBold },
  stack: { flexDirection: 'row', alignItems: 'center' },
  overlap: { marginStart: -8 },
  more: { backgroundColor: colors.primaryTint, borderWidth: 2 },
  moreText: { color: colors.primaryStrong },
  labelled: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  label: { ...type.caption, color: colors.inkMuted, flexShrink: 1 },
});
