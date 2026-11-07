import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useDeleteAccount } from '@/state/profile';
import { useTrips } from '@/state/trips';
import { colors, type } from '@/theme';

const close = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

/**
 * Deleting the account, for good, once the user is in no trip (the API checks too): trips are
 * shared, so they delete theirs or are removed from them first. Opened from the profile.
 */
export default function DeleteAccount() {
  const trips = useTrips();
  const remove = useDeleteAccount();
  // The cached list can be out of date (a trip just deleted, or a new one joined).
  const { refetch } = trips;
  useEffect(() => void refetch(), [refetch]);
  const checking = trips.isFetching && !trips.isRefetchError;
  const inTrip = (trips.data?.trips.length ?? 0) > 0;

  return (
    <Sheet
      title={he.profile.deleteAccountConfirm}
      onClose={close}
      footer={
        !checking &&
        !inTrip && (
          <PillButton
            label={he.profile.deleteAccountYes}
            variant="danger"
            icon={<Icon name="trash" size={18} color={colors.brandStrong} />}
            disabled={remove.isPending}
            {...testId('delete-account-confirm')}
            onPress={() => remove.mutate()}
          />
        )
      }
    >
      {checking ? (
        <ActivityIndicator color={colors.inkMuted} />
      ) : inTrip ? (
        <Text style={styles.body} {...testId('delete-account-in-trip')}>
          {he.profile.deleteAccountInTrip}
        </Text>
      ) : (
        <Text style={styles.warning}>{he.profile.deleteAccountWarning}</Text>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { ...type.body, color: colors.ink },
  warning: { ...type.body, color: colors.brandStrong },
});
