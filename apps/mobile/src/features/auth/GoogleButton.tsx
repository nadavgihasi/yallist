import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { PillButton } from '@/components/PillButton';
import { showToast } from '@/components/Toast';
import { he } from '@/i18n/he';
import { reportError } from '@/lib/sentry';

/**
 * The stage's web OAuth client ID (infra/app/core.ts). Tokens are requested for it, so Better Auth
 * verifies them as it does on web. Google only issues them to an app whose package and signing-key
 * SHA-1 are registered as an Android OAuth client in the same Google Cloud project (docs/android.md).
 */
const CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

if (CLIENT_ID) GoogleSignin.configure({ webClientId: CLIENT_ID });

/**
 * "Continue with Google" through Android's Google account picker. It hands back an ID token,
 * which Better Auth verifies and exchanges for a session; no redirects.
 */
export function GoogleButton({ onIdToken }: { onIdToken: (idToken: string) => void }) {
  const [busy, setBusy] = useState(false);
  if (!CLIENT_ID) return null;

  const signIn = async () => {
    setBusy(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return; // closed the picker
      // Only the ID token is needed. Forgetting the account makes the next sign-in ask again,
      // so someone can switch accounts after signing out.
      void GoogleSignin.signOut().catch(() => {});
      if (!response.data.idToken) throw new Error('Google sign-in returned no ID token');
      onIdToken(response.data.idToken);
    } catch (error) {
      if (isErrorWithCode(error) && error.code === statusCodes.IN_PROGRESS) return;
      // DEVELOPER_ERROR (a missing Android OAuth client or SHA-1) lands here too.
      reportError(error);
      showToast(he.errors.signIn, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <PillButton
      label={he.login.google}
      variant="card"
      size="lg"
      wide
      style={styles.button}
      disabled={busy}
      onPress={() => void signIn()}
    />
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 56, borderRadius: 28 },
});
