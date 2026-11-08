import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DateField } from '@/components/DateField';
import { TextField, fieldStyles } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { useCloseSheet } from '@/features/trip/closeSheet';
import { he } from '@/i18n/he';
import { endAfterMovingStart } from '@/lib/dates';
import { testId } from '@/lib/testId';
import { useTrip, useTripAction } from '@/state/trips';
import { colors, space } from '@/theme';

/**
 * Edits the trip's name and dates (organizers): saves the trimmed name and closes the sheet,
 * nothing if unchanged. Moving the start keeps the end after it. Where the group meets is its
 * own section of the ניהול tab.
 */
export default function EditTrip() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const close = useCloseSheet(tripId);
  const data = useTrip(tripId);
  const act = useTripAction(tripId);
  const [name, setName] = useState(() => data?.trip.name ?? '');
  const [startsOn, setStartsOn] = useState(() => data?.trip.startsOn ?? '');
  const [endsOn, setEndsOn] = useState(() => data?.trip.endsOn ?? '');
  if (!data) return null;

  const trimmed = name.trim();
  const ready = trimmed.length > 0;
  const changed =
    trimmed !== data.trip.name || startsOn !== data.trip.startsOn || endsOn !== data.trip.endsOn;
  const save = () => {
    if (!ready) return;
    close(() => changed && act({ type: 'editTrip', name: trimmed, startsOn, endsOn }));
  };

  return (
    <Sheet
      title={he.renameTrip.title}
      subtitle={he.renameTrip.hint}
      onClose={close}
      footer={
        <PillButton
          label={he.renameTrip.save}
          size="lg"
          wide
          icon={<Icon name="check" size={18} color={colors.onPrimary} />}
          disabled={!ready}
          {...testId('trip-rename-save')}
          onPress={save}
        />
      }
    >
      <View style={styles.form}>
        <TextField
          label={he.renameTrip.label}
          value={name}
          onChangeText={setName}
          placeholder={he.renameTrip.placeholder}
          maxLength={80}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={save}
          {...testId('trip-rename-name')}
        />
        <View style={styles.field}>
          <Text style={fieldStyles.label}>{he.newTrip.when}</Text>
          <View style={styles.dates}>
            <DateField
              label={he.newTrip.from}
              value={startsOn}
              onChange={(iso) => {
                setEndsOn(endAfterMovingStart(startsOn, endsOn, iso));
                setStartsOn(iso);
              }}
            />
            <DateField label={he.newTrip.to} value={endsOn} min={startsOn} onChange={setEndsOn} />
          </View>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: space[4] },
  field: { gap: space[2] },
  dates: { flexDirection: 'row', gap: space[2] },
});
