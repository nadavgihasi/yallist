import * as Linking from 'expo-linking';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { AvatarStack } from '@/components/Avatar';
import { Countdown } from '@/components/Countdown';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/ListGroup';
import { ProgressRing } from '@/components/ProgressRing';
import { he, missingCount, openTransfers, peopleNames } from '@/i18n/he';
import { countdown } from '@/lib/dates';
import { missingMessage } from '@/lib/share';
import { testId } from '@/lib/testId';
import type { TripData } from '@/state/types';
import { colors, radius, size, space, type } from '@/theme';

import { toAvatar, type TripView } from './derive';

/** WhatsApp first: that's where the group is (#51). The share sheet if it can't open. */
async function shareToWhatsApp(text: string) {
  try {
    await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`);
  } catch {
    await Share.share({ message: text }).catch(() => {});
  }
}

/**
 * The top of a trip: how long until it, how ready it is, who's in, what's mine, and one way to
 * act: open what's missing (or invite, while you're alone), or send the missing list to WhatsApp.
 */
export function ReadinessHero({
  data,
  view,
  me,
  now,
  onMissing,
  onInvite,
}: {
  data: TripData;
  view: TripView;
  me: string;
  now: string;
  onMissing: () => void;
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
            <Text style={styles.mine}>
              {he.home.mine}
              {view.mine.map((i) => i.name).join(', ')}
            </Text>
          )}
          {!solo && (
            <AvatarStack
              people={view.active.map(toAvatar)}
              max={4}
              label={peopleNames(view.active.map((m) => m.displayName))}
            />
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
                missingMessage(trip, missing, Linking.createURL(`/j/${data.inviteToken}`)),
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
      <Text style={styles.ctaText} numberOfLines={2}>
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
