import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Cover } from '@/components/Cover';
import { Input } from '@/components/Fields';
import { PillButton } from '@/components/PillButton';
import { showToast } from '@/components/Toast';
import { GoogleButton } from '@/features/auth/GoogleButton';
import { he } from '@/i18n/he';
import { signInAsGuest, signInWithGoogle, type AuthResult } from '@/lib/api';
import { useSession } from '@/state/store';
import { colors, fonts } from '@/theme';

export default function Login() {
  const { me, signIn } = useSession();
  const insets = useSafeAreaInsets();
  const [askName, setAskName] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  if (me) return <Redirect href="/" />;

  const enter = (request: Promise<AuthResult>) => {
    setBusy(true);
    request
      .then(signIn)
      .then(() => router.replace('/'))
      .catch(() => {
        setBusy(false);
        showToast(he.errors.signIn);
      });
  };

  const start = () => {
    const trimmed = name.trim();
    if (trimmed && !busy) enter(signInAsGuest(trimmed));
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Cover scene="camp" style={StyleSheet.absoluteFill} />
      <View style={[styles.panel, { paddingBottom: 28 + insets.bottom }]}>
        <Text style={styles.title} accessibilityRole="header">
          {he.login.title}
        </Text>
        <Text style={styles.subtitle}>{he.login.subtitle}</Text>

        {askName ? (
          <>
            <Input
              value={name}
              onChangeText={setName}
              onSubmitEditing={start}
              placeholder={he.login.namePlaceholder}
              accessibilityLabel={he.login.nameLabel}
              autoFocus
              returnKeyType="go"
              style={styles.input}
            />
            <PillButton
              label={he.login.start}
              size="lg"
              wide
              style={styles.button}
              disabled={!name.trim() || busy}
              onPress={start}
            />
          </>
        ) : (
          <>
            <PillButton
              label={he.login.withName}
              size="lg"
              wide
              style={styles.button}
              onPress={() => setAskName(true)}
            />
            <GoogleButton onIdToken={(idToken) => enter(signInWithGoogle(idToken))} />
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white, justifyContent: 'flex-end' },
  panel: {
    paddingTop: 30,
    paddingHorizontal: 20,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    backgroundColor: colors.white,
    gap: 14,
  },
  title: { fontFamily: fonts.displayBold, fontSize: 36, lineHeight: 40, color: colors.ink },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.inkSecondary,
    marginBottom: 10,
  },
  input: {
    minHeight: 56,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(14,23,38,0.05)',
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.ink,
  },
  button: { minHeight: 56, borderRadius: 28 },
});
