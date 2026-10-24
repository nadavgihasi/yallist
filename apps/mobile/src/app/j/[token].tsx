import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { TextField } from '@/components/Fields';
import { PillButton } from '@/components/PillButton';
import { showToast } from '@/components/Toast';
import { GoogleButton } from '@/features/auth/GoogleButton';
import { he, missingItems, participants } from '@/i18n/he';
import { signInAsGuest, signInWithGoogle, statusOf, type AuthResult } from '@/lib/api';
import { formatRange } from '@/lib/dates';
import { useSession } from '@/state/store';
import { joinTrip, tripsKey, useInvite } from '@/state/trips';
import { colors, fonts, radius, space, type } from '@/theme';

/** Invite links land here (JoinV2): a preview anyone can see, then sign in and join. */
export default function Join() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { me, signIn } = useSession();
  const queryClient = useQueryClient();
  const invite = useInvite(token);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'pending' | 'removed'>();

  // Waiting for an organizer: asking again is harmless and says when we're in.
  const recheck = useQuery({
    queryKey: ['join', token],
    queryFn: () => joinTrip(token),
    enabled: state === 'pending',
    refetchInterval: 10_000,
    // While they switch to WhatsApp to nudge the organizer, too.
    refetchIntervalInBackground: true,
    gcTime: 0,
  });

  const open = (tripId: string) => {
    queryClient.invalidateQueries({ queryKey: tripsKey });
    router.replace({ pathname: '/trips/[tripId]', params: { tripId } });
  };

  const approvedTrip = recheck.data?.status === 'active' ? recheck.data.tripId : undefined;
  useEffect(() => {
    if (approvedTrip) open(approvedTrip);
  });

  const join = async (signingIn?: Promise<AuthResult>) => {
    setBusy(true);
    try {
      if (signingIn) await signIn(await signingIn);
      const result = await joinTrip(token);
      if (result.status === 'active') return open(result.tripId);
      setState('pending');
    } catch (error) {
      if (statusOf(error) === 403) setState('removed');
      else showToast(he.errors.failed);
    }
    setBusy(false);
  };

  if (invite.isPending) return <ActivityIndicator color={colors.accent} style={styles.center} />;

  if (!invite.data) {
    const invalid = (statusOf(invite.error) ?? 500) < 500;
    return (
      <Message
        title={invalid ? he.join.invalid : he.errors.loadFailed}
        text={invalid ? he.join.invalidText : undefined}
      />
    );
  }
  if (state === 'removed') return <Message title={he.join.removed} />;

  const trip = invite.data;
  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.kicker}>{he.join.title}</Text>
      <View style={styles.card}>
        <Text style={styles.name} accessibilityRole="header">
          {trip.name}
        </Text>
        <Text style={styles.meta}>
          {formatRange(trip.startsOn, trip.endsOn)} · {participants(trip.memberCount)}
        </Text>
        {trip.missingCount > 0 && (
          <View style={styles.missing}>
            <Text style={styles.missingTitle}>{missingItems(trip.missingCount)}</Text>
            <Text style={styles.meta}>{trip.missingItems.join(', ')}</Text>
          </View>
        )}
      </View>

      {state === 'pending' ? (
        <View style={styles.card} accessibilityLiveRegion="polite">
          <Text style={styles.strong}>{he.join.pendingTitle}</Text>
          <Text style={styles.meta}>{he.join.pendingText}</Text>
        </View>
      ) : me ? (
        <PillButton label={he.join.join} size="xl" wide disabled={busy} onPress={() => join()} />
      ) : (
        <>
          <TextField
            label={he.join.nameLabel}
            value={name}
            onChangeText={setName}
            onSubmitEditing={() => name.trim() && join(signInAsGuest(name.trim()))}
            placeholder={he.login.namePlaceholder}
            returnKeyType="go"
          />
          <PillButton
            label={he.join.join}
            size="xl"
            wide
            disabled={!name.trim() || busy}
            onPress={() => join(signInAsGuest(name.trim()))}
          />
          <GoogleButton onIdToken={(idToken) => join(signInWithGoogle(idToken))} />
        </>
      )}
    </ScrollView>
  );
}

function Message({ title, text }: { title: string; text?: string }) {
  return (
    <View style={styles.screen}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {text && <Text style={styles.meta}>{text}</Text>}
      <PillButton label={he.join.toTrips} size="lg" onPress={() => router.replace('/')} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1 },
  // Capped and centered so the text doesn't run across a desktop window.
  screen: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    padding: space.screen,
    paddingTop: 64,
    gap: 16,
  },
  title: { ...type.screenTitle, color: colors.ink },
  kicker: { fontFamily: fonts.medium, fontSize: 15, color: colors.inkSecondary },
  card: { padding: 20, borderRadius: radius.card, backgroundColor: colors.surface, gap: 8 },
  name: { fontFamily: fonts.displayBold, fontSize: 32, lineHeight: 38, color: colors.ink },
  meta: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkSecondary },
  missing: { gap: 4, marginTop: 8 },
  missingTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.missing },
  strong: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
});
