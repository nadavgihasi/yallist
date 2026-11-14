import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { TextField } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { useCloseSheet } from '@/features/trip/closeSheet';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useAddPerson } from '@/state/trips';
import { colors, space } from '@/theme';

/** Good enough to catch typos; the API checks it properly. */
const looksLikeEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/**
 * Adds a person to the trip by email, so expenses can be split with them before they open the
 * app. Until they sign in they're shown by their email; signing in with Google with
 * that email brings their name, and the trip is theirs. Closes once the API added them.
 */
export default function AddPerson() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const close = useCloseSheet(tripId);
  const add = useAddPerson(tripId);
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);

  const address = email.trim();
  const validEmail = looksLikeEmail(address);
  const ready = validEmail && !add.isPending;
  const save = () => {
    setTouched(true);
    if (!ready) return;
    add.mutate({ email: address }, { onSuccess: () => close() });
  };

  return (
    <Sheet
      title={he.addPerson.title}
      subtitle={he.addPerson.hint}
      onClose={close}
      footer={
        <PillButton
          label={he.addPerson.save}
          size="lg"
          wide
          icon={<Icon name="userPlus" size={18} color={colors.onPrimary} />}
          disabled={!ready}
          {...testId('add-person-save')}
          onPress={save}
        />
      }
    >
      <View style={styles.form}>
        <TextField
          label={he.addPerson.email}
          value={email}
          onChangeText={setEmail}
          onBlur={() => setTouched(true)}
          placeholder="name@gmail.com"
          maxLength={254}
          autoFocus
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          returnKeyType="done"
          onSubmitEditing={save}
          error={touched && address.length > 0 && !validEmail ? he.addPerson.emailError : undefined}
          style={styles.ltr}
          {...testId('add-person-email')}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: space[4] },
  // An address reads left to right, even in a right-to-left form.
  ltr: { writingDirection: 'ltr', textAlign: 'left' },
});
