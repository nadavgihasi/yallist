import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarStack } from '@/components/Avatar';
import { Input } from '@/components/Fields';
import { Card } from '@/components/ListGroup';
import { Logo } from '@/components/Logo';
import { PillButton } from '@/components/PillButton';
import { StatusRing } from '@/components/StatusRing';
import { showToast } from '@/components/Toast';
import { VersionLine } from '@/components/VersionLine';
import { GoogleButton } from '@/features/auth/GoogleButton';
import { he } from '@/i18n/he';
import { signInAsGuest, signInWithGoogle, type AuthResult } from '@/lib/api';
import { useSession } from '@/state/store';
import { colors, layout, radius, space, type } from '@/theme';

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
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: 88 + insets.top, paddingBottom: 32 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <Logo />
          <Text style={styles.title} accessibilityRole="header">
            {he.login.title}
          </Text>
          <Text style={styles.subtitle}>{he.login.subtitle}</Text>
        </View>

        <Sample />

        <View style={styles.actions}>
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
                onPress={() => setAskName(true)}
              />
              <GoogleButton onIdToken={(idToken) => enter(signInWithGoogle(idToken))} />
            </>
          )}
        </View>
        <VersionLine />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** A static list card showing what a trip looks like (login.html). */
function Sample() {
  const s = he.login.sample;
  return (
    <Card accessibilityLabel={s.label}>
      <View style={styles.sampleHead}>
        <View style={styles.texts}>
          <Text style={styles.itemTitle}>{s.trip}</Text>
          <Text style={styles.caption}>{s.meta}</Text>
        </View>
        <AvatarStack people={s.members.map((initial) => ({ initial }))} max={2} />
      </View>
      {s.items.map(([item, caption]) => (
        <View key={item} style={styles.row}>
          <StatusRing state="done" label={s.done} />
          <View style={styles.texts}>
            <Text style={styles.itemTitle}>{item}</Text>
            <Text style={styles.caption}>{caption}</Text>
          </View>
        </View>
      ))}
      <View style={styles.row}>
        <StatusRing state="open" />
        <View style={styles.texts}>
          <Text style={styles.itemTitle}>{s.open[0]}</Text>
          <Text style={styles.caption}>{s.open[1]}</Text>
        </View>
        {/* Only a picture of the button: the card is an example. */}
        <View style={styles.claim}>
          <Text style={styles.claimText}>{s.claim}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: layout.contentMax,
    alignSelf: 'center',
    paddingHorizontal: space.screen,
    gap: 32,
  },
  intro: { alignItems: 'center', gap: space[3] },
  title: { ...type.sectionTitle, color: colors.ink, marginTop: space[4], textAlign: 'center' },
  subtitle: { ...type.body, color: colors.inkMuted, maxWidth: 300, textAlign: 'center' },
  sampleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  texts: { flexShrink: 1, flexGrow: 1, gap: space[1] },
  itemTitle: { ...type.itemTitle, color: colors.ink },
  caption: { ...type.caption, color: colors.inkMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: space.touch },
  claim: {
    height: space.touch,
    paddingHorizontal: space[5],
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    justifyContent: 'center',
  },
  claimText: { ...type.buttonSm, color: colors.primaryStrong },
  // Pinned to the bottom of the screen when the content is short (login.html `margin-top: auto`).
  actions: { marginTop: 'auto', gap: space[3] },
  input: {
    minHeight: 60,
    paddingHorizontal: space[5],
    borderRadius: radius.pill,
    backgroundColor: colors.card,
    ...type.body,
    color: colors.ink,
  },
});
