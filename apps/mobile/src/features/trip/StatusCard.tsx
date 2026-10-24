import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { AvatarStack } from '@/components/Avatar';
import { Progress } from '@/components/Progress';
import { he } from '@/i18n/he';
import type { TripMember } from '@/state/types';
import { colors, fonts, radius } from '@/theme';

import { toAvatar, type TripView } from './derive';

/** Big missing count + covered text + avatars + pegs, overlapping the cover. */
export function StatusCard({
  view,
  members,
  me,
  style,
}: {
  view: TripView;
  members: TripMember[];
  me: string;
  style?: StyleProp<ViewStyle>;
}) {
  const avatars = <AvatarStack people={members.map((m) => toAvatar(m))} />;
  // Nothing to cover yet: a neutral line, not a green "0, all covered" (matches TripCard).
  if (view.items.length === 0) {
    return (
      <View style={[styles.card, styles.top, style]}>
        <Text style={styles.empty}>{he.home.noItems}</Text>
        {avatars}
      </View>
    );
  }

  const missing = view.missingCount;
  const label =
    missing === 0 ? he.trip.allCovered : missing === 1 ? he.trip.oneMissing : he.trip.manyMissing;
  return (
    <View style={[styles.card, style]}>
      <View style={styles.top}>
        <View style={styles.numberRow}>
          <Text
            style={[styles.number, { color: missing === 0 ? colors.inkMuted : colors.brandStrong }]}
          >
            {missing}
          </Text>
          <View style={styles.texts}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.covered}>
              {he.trip.coveredOf(view.doneCount, view.items.length)}
            </Text>
          </View>
        </View>
        {avatars}
      </View>
      <Progress done={view.doneCount} total={view.items.length} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: -28,
    marginHorizontal: 12,
    padding: 20,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    gap: 16,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  number: { fontFamily: fonts.extraBold, fontSize: 56, lineHeight: 56 },
  texts: { gap: 2, flexShrink: 1 },
  label: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  empty: { fontFamily: fonts.bold, fontSize: 16, color: colors.inkMuted, flexShrink: 1 },
  covered: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted },
});
