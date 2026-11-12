import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AvatarStack } from '@/components/Avatar';
import { Callout } from '@/components/Callout';
import { Cover } from '@/components/Cover';
import { EmptyState, StateScreen } from '@/components/EmptyState';
import { TextField } from '@/components/Fields';
import { Loader } from '@/components/Loader';
import { PillButton } from '@/components/PillButton';
import { showToast } from '@/components/Toast';
import { GoogleButton } from '@/features/auth/GoogleButton';
import { andMore, he, joiningAs, missingItems, participants } from '@/i18n/he';
import { initial } from '@/features/trip/derive';
import { signInAsGuest, signInWithGoogle, statusOf, type AuthResult } from '@/lib/api';
import { rtl } from '@/lib/bidi';
import { formatRange } from '@/lib/dates';
import { inviteToken, whoIsIn } from '@/lib/invite';
import { testId } from '@/lib/testId';
import { useSession } from '@/state/store';
import { joinTrip, tripsKey, useInvite } from '@/state/trips';
import { avatarSize, colors, layout, radius, space, type } from '@/theme';

/** Invite links land here (JoinV2): a preview anyone can see, then sign in and join. */
export default function Join() {
  const token = inviteToken(useLocalSearchParams<{ token: string }>().token);
  const { me, signIn } = useSession();
  const queryClient = useQueryClient();
  const invite = useInvite(token);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<'pending' | 'removed'>();
  // A signed-in visitor's place in the trip, from the preview.
  const membership = invite.data?.membership;
  const pending = state === 'pending' || membership?.status === 'pending';

  // Waiting for an organizer: asking again is harmless and says when we're in.
  const recheck = useQuery({
    queryKey: ['join', token],
    queryFn: () => joinTrip(token),
    enabled: pending,
    // Stops once declined (403): the page says so instead.
    refetchInterval: (query) => (statusOf(query.state.error) === 403 ? false : 10_000),
    // While they switch to WhatsApp to nudge the organizer, too.
    refetchIntervalInBackground: true,
    gcTime: 0,
  });

  /** To the trip; `joined` when we just got in, so it asks once what we'll bring. */
  const open = (tripId: string, joined = false) => {
    void queryClient.invalidateQueries({ queryKey: tripsKey });
    router.replace({
      pathname: '/trips/[tripId]',
      params: joined ? { tripId, joined: '1' } : { tripId },
    });
  };

  const approvedTrip = recheck.data?.status === 'active' ? recheck.data.tripId : undefined;
  // Once, when an organizer approves.
  useEffect(() => {
    if (approvedTrip) open(approvedTrip, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `open` is new every render
  }, [approvedTrip]);

  // Opening the link to a trip we're already in goes straight to it (#125).
  const memberOf = membership?.status === 'active' ? membership.tripId : undefined;
  useEffect(() => {
    if (!memberOf) return;
    showToast(he.join.alreadyIn);
    open(memberOf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `open` is new every render
  }, [memberOf]);

  const join = async (signingIn?: () => Promise<AuthResult>) => {
    if (busy) return;
    setBusy(true);
    try {
      if (signingIn) await signIn(await signingIn());
    } catch {
      setBusy(false);
      return showToast(he.errors.signIn, 'error');
    }
    try {
      const result = await joinTrip(token);
      if (result.status === 'active') return open(result.tripId, true);
      setState('pending');
    } catch (error) {
      const status = statusOf(error);
      if (status === 403) setState('removed');
      // 401: the session expired; the store says so and this page asks for a name again.
      else if (status !== 401) showToast(he.errors.failed, 'error');
    }
    setBusy(false);
  };
  const joinAsGuest = () => {
    const trimmed = name.trim();
    if (trimmed) void join(() => signInAsGuest(trimmed));
  };

  if (invite.isPending || memberOf) return <Loader line={he.states.joinLoading} />;

  const leave = {
    label: me ? he.join.toTrips : he.join.toStart,
    onPress: () => router.replace('/'),
  };
  if (!invite.data) {
    return (statusOf(invite.error) ?? 500) < 500 ? (
      <StateScreen
        spot="signpost"
        title={he.join.invalid}
        text={he.join.invalidText}
        actions={[leave]}
      />
    ) : (
      <StateScreen
        spot="noSignal"
        {...he.states.offline}
        actions={[{ label: he.errors.retry, onPress: () => void invite.refetch() }, leave]}
      />
    );
  }
  if (state === 'removed' || statusOf(recheck.error) === 403)
    return (
      <StateScreen
        spot="signpost"
        title={he.join.removed}
        text={he.join.removedText}
        actions={[leave]}
      />
    );

  const trip = invite.data;
  if (pending)
    return (
      <View style={styles.screen} accessibilityLiveRegion="polite">
        <EmptyState
          spot="tentDoor"
          title={he.join.pendingTitle}
          text={he.join.pendingText(trip.name)}
          actions={[
            {
              label: recheck.isFetching ? he.join.checking : he.join.checkNow,
              onPress: () => void recheck.refetch(),
              testID: 'join-check',
            },
            leave,
          ]}
        />
        <Callout title={he.states.tip} text={he.join.pendingTip} />
      </View>
    );

  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <Text style={styles.kicker}>{he.join.invited}</Text>
      <View style={[styles.card, styles.invite]}>
        <Cover
          scene={trip.cover}
          style={styles.cover}
          testID={`join-cover-${trip.cover}`}
          horizon
        />
        <Text style={styles.name} accessibilityRole="header">
          {trip.name}
        </Text>
        <Text style={styles.meta}>
          {formatRange(trip.startsOn, trip.endsOn)} · {participants(trip.memberCount)}
        </Text>
        {trip.members.length > 0 && (
          <View style={styles.members} {...testId('join-members')}>
            <AvatarStack
              people={trip.members.map((m) => ({ initial: initial(m.name), color: m.color }))}
              max={5}
              size={avatarSize.md}
            />
            <Text style={[styles.meta, styles.names]}>
              {whoIsIn(
                trip.members.map((m) => m.name),
                trip.memberCount,
              )}
            </Text>
          </View>
        )}
        {trip.missingCount > 0 && (
          <View style={styles.missing}>
            <Text style={styles.missingTitle}>{missingItems(trip.missingCount)}</Text>
            <Text style={styles.meta}>
              {/* Each name isolated, so `סוללות AA, Tent גדול` keeps its order. */}
              {(trip.missingCount > trip.missingItems.length
                ? [
                    ...trip.missingItems.map(rtl),
                    andMore(trip.missingCount - trip.missingItems.length),
                  ]
                : trip.missingItems.map(rtl)
              ).join(', ')}
            </Text>
          </View>
        )}
      </View>

      {me ? (
        <>
          <PillButton
            label={busy ? he.join.joining : he.join.join}
            size="lg"
            wide
            disabled={busy}
            onPress={() => join()}
          />
          <Text style={styles.note}>{joiningAs(me.name)}</Text>
        </>
      ) : (
        <>
          <View style={styles.card}>
            <TextField
              label={he.join.nameLabel}
              value={name}
              onChangeText={setName}
              onSubmitEditing={joinAsGuest}
              placeholder={he.login.namePlaceholder}
              returnKeyType="go"
              {...testId('join-name')}
            />
          </View>
          <PillButton
            label={busy ? he.join.joining : he.join.join}
            size="lg"
            wide
            disabled={!name.trim() || busy}
            {...testId('join-submit')}
            onPress={joinAsGuest}
          />
          <Text style={styles.note}>{he.join.noAccount}</Text>
          <GoogleButton onIdToken={(idToken) => void join(() => signInWithGoogle(idToken))} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // One column, centered on wide screens.
  screen: {
    width: '100%',
    maxWidth: layout.contentMax,
    alignSelf: 'center',
    padding: space.screen,
    paddingTop: 64,
    gap: space[4],
  },
  kicker: { ...type.buttonSm, color: colors.inkMuted },
  card: {
    padding: space[5],
    borderRadius: radius.card,
    backgroundColor: colors.card,
    gap: space[2],
  },
  // The cover runs edge to edge across the card's top.
  invite: { overflow: 'hidden' },
  cover: { height: 120, margin: -space[5], marginBottom: space[2] },
  name: { ...type.pageTitle, color: colors.ink },
  meta: { ...type.caption, color: colors.inkMuted },
  members: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginTop: space[1] },
  // Hebrew order even when the first name is Latin (`Dana ונועה כבר בטיול`).
  names: { flex: 1, writingDirection: 'rtl' },
  missing: { gap: space[1], marginTop: space[2] },
  missingTitle: { ...type.itemTitle, color: colors.ink },
  note: { ...type.caption, color: colors.inkMuted, textAlign: 'center' },
});
