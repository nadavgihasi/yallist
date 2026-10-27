import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Switch } from '@/components/Controls';

import { TextField } from '@/components/Fields';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { useCloseSheet } from '@/features/trip/closeSheet';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useTripAction } from '@/state/trips';
import { colors, fonts, type } from '@/theme';

/** Same limit as the API's. */
const MAX_NAME = 60;

/** Something only I need, into my bag (packing spec §6.3). Always a private item. */
export default function AddToBag() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const act = useTripAction(tripId);
  const close = useCloseSheet(tripId);
  const [name, setName] = useState('');
  const [saveAsEssential, setSaveAsEssential] = useState(false);
  const trimmed = name.trim();
  const save = () =>
    trimmed && close(() => act({ type: 'addPrivateItem', name: trimmed, saveAsEssential }));
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
      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.switchLabel}>{he.bag.add.essential}</Text>
          <Text style={styles.caption}>{he.bag.add.essentialCaption}</Text>
        </View>
        <Switch
          value={saveAsEssential}
          onChange={setSaveAsEssential}
          label={he.bag.add.essential}
          testID="bag-add-essential"
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  // As in the add-item sheet (ItemForm).
  switchRow: {
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: colors.ground,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  caption: { ...type.caption, color: colors.inkMuted },
});
