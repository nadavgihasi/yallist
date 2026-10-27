import { runSummary } from '@yallist/domain';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useFinishWaiting } from '@/state/trips';
import type { TripData } from '@/state/types';
import { avatarSize, colors, radius, space, type } from '@/theme';

import type { TripView } from './derive';

/**
 * The top of the buy list (PACKING_SHOPPING_SPEC §6.5, §6.8): my open run, or the button that
 * starts one; and who else is at the store now.
 */
export function ShopBanner({ data, view, me }: { data: TripData; view: TripView; me: string }) {
  const tripId = data.trip.id;
  const waiting = useFinishWaiting(tripId);
  const count = (runId: string) => {
    const { inCart, notInCart } = runSummary(view.runClaims(runId), view.items);
    return inCart.length + notInCart.length;
  };
  const { myRun } = view;
  const others = data.runs.filter((r) => r.shopperId !== me);

  return (
    <>
      {myRun ? (
        <Pressable
          accessibilityRole="button"
          {...testId('shop-open')}
          onPress={() => router.push({ pathname: '/trips/[tripId]/shop', params: { tripId } })}
          style={styles.mine}
        >
          <Icon name="cart" color={colors.onPrimary} />
          <Text style={styles.mineText}>
            {[he.shop.mine(count(myRun.id)), waiting && he.shop.waiting]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <Icon name="chevronEnd" size={20} color={colors.onPrimary} />
        </Pressable>
      ) : (
        view.runEligible.length > 0 && (
          <PillButton
            label={he.shop.start}
            variant="soft"
            icon={<Icon name="cart" size={18} color={colors.primaryStrong} />}
            {...testId('shop-start')}
            onPress={() =>
              router.push({ pathname: '/trips/[tripId]/shop/start', params: { tripId } })
            }
            style={styles.start}
          />
        )
      )}
      {others.map((run) => (
        <Card key={run.id} style={styles.other}>
          <Avatar person={view.avatarOf(run.shopperId)} size={avatarSize.md} />
          <Text style={styles.otherText}>
            {he.shop.others(view.displayNameOf(run.shopperId), count(run.id))}
          </Text>
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  start: { alignSelf: 'flex-start' },
  mine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: 56,
    paddingHorizontal: space[5],
    borderRadius: radius.card,
    backgroundColor: colors.primary,
  },
  mineText: { ...type.itemTitle, color: colors.onPrimary, flex: 1 },
  other: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[3] },
  otherText: { ...type.itemTitle, color: colors.ink, flex: 1 },
});
