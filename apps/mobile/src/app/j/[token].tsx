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
import { colors, layout, radius, space, type } from '@/theme';

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

  if (invite.isPending) return <ActivityIndicator color={colors.primary} style={styles.center} />;

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
        <PillButton label={he.join.join} size="lg" wide disabled={busy} onPress={() => join()} />
      ) : (
        <>
          <View style={styles.card}>
            <TextField
              label={he.join.nameLabel}
              value={name}
              onChangeText={setName}
              onSubmitEditing={() => name.trim() && join(signInAsGuest(name.trim()))}
              placeholder={he.login.namePlaceholder}
              returnKeyType="go"
            />
          </View>
          <PillButton
            label={he.join.join}
            size="lg"
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
  // One column, centered on wide screens.
  screen: {
    width: '100%',
    maxWidth: layout.contentMax,
    alignSelf: 'center',
    padding: space.screen,
    paddingTop: 64,
    gap: space[4],
  },
  title: { ...type.sectionTitle, color: colors.ink },
  kicker: { ...type.buttonSm, color: colors.inkMuted },
  card: {
    padding: space[5],
    borderRadius: radius.card,
    backgroundColor: colors.card,
    gap: space[2],
  },
  name: { ...type.pageTitle, color: colors.ink },
  meta: { ...type.caption, color: colors.inkMuted },
  missing: { gap: space[1], marginTop: space[2] },
  missingTitle: { ...type.itemTitle, color: colors.ink },
  strong: { ...type.itemTitle, color: colors.ink },
});
