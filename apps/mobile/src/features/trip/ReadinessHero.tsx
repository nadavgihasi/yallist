import * as Linking from 'expo-linking';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { Countdown } from '@/components/Countdown';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/ListGroup';
import { ProgressRing } from '@/components/ProgressRing';
import { firstNames, he, missingCount, openTransfers } from '@/i18n/he';
import { countdown } from '@/lib/dates';
import { missingMessage, openWhatsApp } from '@/lib/share';
import { testId } from '@/lib/testId';
import type { TripData } from '@/state/types';
import { colors, radius, size, space, type } from '@/theme';

import type { TripView } from './derive';

/**
 * WhatsApp first: that's where the group is (#51); in a new tab on web. The share sheet if it
 * can't open.
 */
async function shareToWhatsApp(text: string) {
  try {
    await openWhatsApp(text, Platform.OS, Linking.openURL);
  } catch {
    await Share.share({ message: text }).catch(() => {});
  }
}

/**
 * The top of a trip: how long until it, how ready it is, what's mine, and one way to act: open
 * what's missing (or invite, while you're alone), or send the missing list to WhatsApp. Who's in
 * is under the trip's name.
 */
export function ReadinessHero({
  data,
  view,
  me,
  now,
  onMissing,
  onMine,
  onInvite,
}: {
  data: TripData;
  view: TripView;
  me: string;
  now: string;
  onMissing: () => void;
  /** Opens the list on what's mine: the line names only the first few. */
  onMine: () => void;
  onInvite: () => void;
}) {
  const { trip } = data;
  const { phase } = countdown(trip.startsOn, trip.endsOn, now);
  // Bring list first, each in list order.
  const missing = view.items
    .filter((i) => !view.done(i))
    .sort((a, b) => (a.list === b.list ? 0 : a.list === 'bring' ? -1 : 1))
    .map((i) => i.name);
  const solo = view.active.length === 1;
  // The first few and `ועוד 11`, not every name over three lines.
  const mineNames = firstNames(view.mine.map((i) => i.name));
  const myTransfers = view.transfers.filter((t) => t.from === me || t.to === me).length;

  let action;
  if (phase === 'after') {
    action = (
      <Text style={styles.line}>
        {myTransfers > 0 ? openTransfers(myTransfers) : he.money.settled}
      </Text>
    );
  } else if (solo) {
    action = (
      <Cta label={he.hero.solo} icon="userPlus" testID="trip-hero-invite" onPress={onInvite} />
    );
  } else if (missing.length > 0) {
    action = (
      <Cta
        label={he.hero.missing(
          missingCount(missing.length),
          missing.slice(0, 3),
          missing.length > 3,
        )}
        testID="trip-hero-missing"
        onPress={onMissing}
      />
    );
  } else {
    action = <Text style={styles.line}>{he.trip.allCovered}</Text>;
  }

  return (
    <Card gap={space[4]}>
      <View style={styles.top}>
        <View style={styles.texts}>
          <Countdown startsOn={trip.startsOn} endsOn={trip.endsOn} now={now} variant="hero" />
          {view.mine.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={he.hero.mineLabel(mineNames)}
              {...testId('trip-hero-mine')}
              onPress={onMine}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.mine} numberOfLines={2}>
                {he.home.mine}
                {mineNames}
              </Text>
            </Pressable>
          )}
        </View>
        {view.items.length > 0 && (
          <ProgressRing done={view.doneCount} total={view.items.length} size="hero" />
        )}
      </View>
      <View style={styles.actions}>
        {action}
        {phase !== 'after' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={he.hero.share}
            {...testId('trip-hero-share')}
            onPress={() =>
              shareToWhatsApp(
                missingMessage(
                  trip,
                  missing,
                  // On web, under the site's base path (/pr-<n> on a PR preview).
                  Linking.createURL(`${process.env.EXPO_BASE_URL ?? ''}/j/${data.inviteToken}`),
                ),
              )
            }
            style={({ pressed }) => [styles.share, pressed && styles.pressed]}
          >
            <Icon name="share" size={20} color={colors.primaryStrong} />
          </Pressable>
        )}
      </View>
    </Card>
  );
}

/** The tonal call to action, chevron at the end. */
function Cta({
  label,
  icon,
  testID,
  onPress,
}: {
  label: string;
  icon?: 'userPlus';
  testID: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      {...testId(testID)}
      onPress={onPress}
      style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
    >
      {icon && <Icon name={icon} size={18} color={colors.primaryStrong} />}
      <Text style={styles.ctaText} numberOfLines={1}>
        {label}
      </Text>
      <Icon name="chevronEnd" size={18} color={colors.primaryStrong} strokeWidth={2.5} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  texts: { flex: 1, gap: space[2] },
  mine: { ...type.caption, fontFamily: type.itemTitle.fontFamily, color: colors.brandStrong },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  line: { ...type.itemTitle, color: colors.ink, flex: 1 },
  cta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: size.buttonSm,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.card,
    backgroundColor: colors.primaryTint,
  },
  ctaText: { ...type.buttonSm, color: colors.primaryStrong, flex: 1 },
  share: {
    width: size.buttonSm,
    height: size.buttonSm,
    borderRadius: size.buttonSm / 2,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75 },
});
