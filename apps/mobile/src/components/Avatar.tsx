import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

export interface AvatarPerson {
  initial: string;
}

/** Initial badge: `primary` fill, `onPrimary` letter. `dimmed` for someone left out (share picker). */
export function Avatar({
  person,
  size = 32,
  ring = true,
  dimmed = false,
}: {
  person: AvatarPerson;
  size?: number;
  ring?: boolean;
  dimmed?: boolean;
}) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          backgroundColor: dimmed ? colors.primaryTint : colors.primary,
          borderWidth: ring ? 2 : 0,
        },
      ]}
    >
      <Text
        style={[
          styles.initial,
          {
            color: dimmed ? colors.primaryStrong : colors.onPrimary,
            fontSize: Math.round(size * 0.42),
          },
        ]}
      >
        {person.initial}
      </Text>
    </View>
  );
}

/** Overlapping avatars with a "+N" bubble when there are more than `max`. */
export function AvatarStack({
  people,
  max = 3,
  size = 28,
}: {
  people: AvatarPerson[];
  max?: number;
  size?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <View style={styles.stack}>
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
});
