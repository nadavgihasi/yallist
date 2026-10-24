import { StyleSheet, Text, View } from 'react-native';

import { AvatarStack } from '@/components/Avatar';
import { Pegs } from '@/components/Pegs';
import { he } from '@/i18n/he';
import type { TripMember } from '@/state/types';
import { colors, fonts, radius } from '@/theme';

import { toAvatar, type TripView } from './derive';

/** Big missing count + covered text + avatars + pegs, overlapping the cover. */
export function StatusCard({
  view,
  members,
  me,
}: {
  view: TripView;
  members: TripMember[];
  me: string;
}) {
  const missing = view.missingCount;
  const label =
    missing === 0 ? he.trip.allCovered : missing === 1 ? he.trip.oneMissing : he.trip.manyMissing;
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.numberRow}>
          <Text style={[styles.number, { color: missing === 0 ? colors.success : colors.missing }]}>
            {missing}
          </Text>
          <View style={styles.texts}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.covered}>
              {he.trip.coveredOf(view.doneCount, view.items.length)}
            </Text>
          </View>
        </View>
        <AvatarStack people={members.map((m) => toAvatar(m, me))} />
      </View>
      <Pegs done={view.doneCount} total={view.items.length} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: -28,
    marginHorizontal: 12,
    padding: 20,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    gap: 16,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  number: { fontFamily: fonts.displayBold, fontSize: 56, lineHeight: 60 },
  texts: { gap: 2, flexShrink: 1 },
  label: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  covered: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkSecondary },
});
