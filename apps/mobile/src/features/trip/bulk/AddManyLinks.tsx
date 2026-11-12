import type { ListKind } from '@yallist/domain';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useTrips } from '@/state/trips';
import { colors, space, type } from '@/theme';

import { copySources } from './copyState';

/** A quiet link button: an icon and a label in primary. */
function Link({
  icon,
  label,
  onPress,
  id,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  id: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.link} {...testId(id)}>
      <Icon name={icon} size={16} color={colors.primaryStrong} strokeWidth={2.5} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

/** Opens copying from a previous trip, in place of the sheet it's in. */
export function CopyLink({ tripId }: { tripId: string }) {
  return (
    <Link
      icon="calendar"
      label={he.bulk.copy.open}
      onPress={() => router.replace({ pathname: '/trips/[tripId]/items/copy', params: { tripId } })}
      id="copy-open"
    />
  );
}

/**
 * An empty list's way to start from a previous trip; only when I have one with items.
 */
export function CopyFromTripButton({ tripId }: { tripId: string }) {
  const trips = useTrips().data?.trips ?? [];
  if (copySources(trips, tripId).length === 0) return null;
  return (
    <PillButton
      label={he.bulk.copy.open}
      variant="soft"
      icon={<Icon name="calendar" size={18} color={colors.primaryStrong} />}
      onPress={() => router.push({ pathname: '/trips/[tripId]/items/copy', params: { tripId } })}
      {...testId('empty-copy')}
    />
  );
}

/**
 * The add-item sheet's ways to add many: bulk mode, taking along what's typed so far, and copying
 * from a previous trip.
 */
export function AddManyLinks({
  tripId,
  list,
  text,
}: {
  tripId: string;
  list: ListKind;
  text: string;
}) {
  return (
    <>
      <Link
        icon="plus"
        label={he.bulk.open}
        onPress={() =>
          router.replace({ pathname: '/trips/[tripId]/items/bulk', params: { tripId, list, text } })
        }
        id="bulk-open"
      />
      <CopyLink tripId={tripId} />
    </>
  );
}

const styles = StyleSheet.create({
  link: {
    minHeight: space.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    alignSelf: 'flex-start',
  },
  label: { ...type.buttonSm, color: colors.primaryStrong },
});
