import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

export interface AvatarPerson {
  initial: string;
  color: string;
  isMe?: boolean;
}

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
  const bg = dimmed ? '#E9ECF2' : person.isMe ? colors.accent : person.color;
  const fg = dimmed ? colors.inkSecondary : person.isMe ? colors.white : colors.ink;
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          borderWidth: ring ? 2 : 0,
        },
      ]}
    >
      <Text style={{ color: fg, fontFamily: fonts.semibold, fontSize: Math.round(size * 0.42) }}>
        {person.initial}
      </Text>
    </View>
  );
}

/** Overlapping avatars with a "+N" bubble when there are more than `max`. */
export function AvatarStack({
  people,
  max = 4,
  size = 32,
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
        <View
          style={[
            styles.avatar,
            styles.overlap,
            styles.more,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <Text style={styles.moreText}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center', borderColor: colors.white },
  stack: { flexDirection: 'row', alignItems: 'center' },
  overlap: { marginStart: -8 },
  more: { backgroundColor: colors.ground, borderWidth: 2 },
  moreText: { color: colors.inkSecondary, fontFamily: fonts.semibold, fontSize: 12 },
});
