import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { TextField } from '@/components/Fields';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { useCloseSheet } from '@/features/trip/closeSheet';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useTripAction } from '@/state/trips';

/** Same limit as the API's. */
const MAX_NAME = 60;

/** Something only I need, into my bag (packing spec §6.3). Always a private item. */
export default function AddToBag() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const act = useTripAction(tripId);
  const close = useCloseSheet(tripId);
  const [name, setName] = useState('');
  const trimmed = name.trim();
  const save = () => trimmed && close(() => act({ type: 'addPrivateItem', name: trimmed }));
  return (
    <Sheet
      title={he.bag.add.title}
      onClose={close}
      footer={
        <PillButton
          label={he.bag.add.submit}
          size="lg"
          disabled={!trimmed}
          {...testId('bag-add-save')}
          onPress={save}
        />
      }
    >
      <TextField
        label={he.bag.add.name}
        value={name}
        onChangeText={setName}
        maxLength={MAX_NAME}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={save}
        {...testId('bag-add-name')}
      />
    </Sheet>
  );
}
