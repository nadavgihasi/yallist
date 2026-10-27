import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { TextField } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { useCloseSheet } from '@/features/trip/closeSheet';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useDeleteTrip, useTrip } from '@/state/trips';
import { colors, type } from '@/theme';

/**
 * Deletes the trip for everyone (organizers; the API checks). It can't be undone, so the button
 * only works once the trip's name is typed.
 */
export default function DeleteTrip() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const close = useCloseSheet(tripId);
  const data = useTrip(tripId);
  const remove = useDeleteTrip(tripId);
  const [name, setName] = useState('');
  if (!data) return null;
  const ready = name.trim() === data.trip.name.trim() && !remove.isPending;
  return (
    <Sheet
      title={he.deleteTrip.title}
      subtitle={data.trip.name}
      onClose={close}
      footer={
        <PillButton
          label={he.deleteTrip.confirm}
          variant="danger"
          icon={<Icon name="trash" size={18} color={colors.brandStrong} />}
          disabled={!ready}
          {...testId('trip-delete-confirm')}
          onPress={() => remove.mutate()}
        />
      }
    >
      <Text style={styles.warning}>{he.deleteTrip.warning}</Text>
      <TextField
        label={he.deleteTrip.nameLabel}
        value={name}
        onChangeText={setName}
        placeholder={data.trip.name}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="done"
        onSubmitEditing={() => ready && remove.mutate()}
        {...testId('trip-delete-name')}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  warning: { ...type.body, color: colors.brandStrong },
});
