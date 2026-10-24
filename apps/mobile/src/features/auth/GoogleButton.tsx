import { StyleSheet, Text } from 'react-native';

import { PillButton } from '@/components/PillButton';
import { he } from '@/i18n/he';
import { colors, fonts } from '@/theme';

/** Google sign-in on Android needs its own OAuth client and SDK; until then, web only. */
export function GoogleButton(_: { onIdToken: (idToken: string) => void }) {
  return (
    <>
      <PillButton
        label={he.login.google}
        variant="outline"
        size="lg"
        wide
        style={styles.button}
        disabled
      />
      <Text style={styles.note}>{he.login.googleSoon}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 56, borderRadius: 28 },
  note: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.inkSecondary,
    textAlign: 'center',
  },
});
