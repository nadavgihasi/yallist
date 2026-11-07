import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { TextField } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { useCloseSheet } from '@/features/trip/closeSheet';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useTrip, useTripAction } from '@/state/trips';
import { colors } from '@/theme';

/** Renames the trip (organizers): saves the trimmed name and closes the sheet, nothing if unchanged. */
export default function RenameTrip() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const close = useCloseSheet(tripId);
  const data = useTrip(tripId);
  const act = useTripAction(tripId);
  const [name, setName] = useState(() => data?.trip.name ?? '');
  if (!data) return null;

  const trimmed = name.trim();
  const ready = trimmed.length > 0;
  const save = () => {
    if (!ready) return;
    close(() => trimmed !== data.trip.name && act({ type: 'renameTrip', name: trimmed }));
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
    </Sheet>
  );
}
