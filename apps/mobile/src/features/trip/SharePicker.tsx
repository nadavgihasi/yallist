import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PersonChip } from '@/components/Chips';
import { fieldStyles } from '@/components/Fields';
import { he } from '@/i18n/he';
import { formatShekel } from '@yallist/domain';
import { colors, fonts } from '@/theme';

import type { TripView } from './derive';

/** "מתחלק בין" chips with a live per-person amount. Excluded people are dimmed. */
export function SharePicker({
  view,
  shares,
  onChange,
  amount,
  showHint = true,
}: {
  view: TripView;
  shares: string[];
  onChange: (shares: string[]) => void;
  amount: number | undefined;
  showHint?: boolean;
}) {
  const perPerson = amount && shares.length > 0 ? amount / shares.length : undefined;
  const toggle = (id: string) =>
    onChange(shares.includes(id) ? shares.filter((s) => s !== id) : [...shares, id]);
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={fieldStyles.label}>{he.item.splitBetween}</Text>
        {perPerson !== undefined && (
          <Text style={styles.per} accessibilityLiveRegion="polite">
            {he.item.perPerson(formatShekel(Math.round(perPerson), 1))}
          </Text>
        )}
      </View>
      <View style={styles.chips} accessibilityLabel={he.item.splitBetween}>
        {view.activeIds.map((id) => (
          <PersonChip
            key={id}
            person={view.avatarOf(id)}
            name={view.nameOf(id)}
            selected={shares.includes(id)}
            onPress={() => toggle(id)}
          />
        ))}
      </View>
      {(showHint || shares.length === 0) && (
        <Text style={styles.hint}>
          {shares.length === 0
            ? he.item.pickSomeone
            : amount === undefined
              ? he.item.enterAmount
              : he.item.splitHint(shares.length, view.activeIds.length)}
        </Text>
      )}
    </View>
  );
}

/** Shares default to every active member. */
export function useShares(view: TripView, initial?: string[]) {
  return useState<string[]>(() => initial ?? view.activeIds);
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  per: { fontFamily: fonts.display, fontSize: 22, color: colors.accent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkSecondary },
});
