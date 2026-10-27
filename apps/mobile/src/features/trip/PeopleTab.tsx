import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { Card, ListGroup } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { showToast } from '@/components/Toast';
import { he, participants } from '@/i18n/he';
import { invitePayload, inviteUrl } from '@/lib/invite';
import { testId } from '@/lib/testId';
import { useTripAction } from '@/state/trips';
import type { TripData, TripMember } from '@/state/types';
import { colors, space, type } from '@/theme';

import { toAvatar, type TripView } from './derive';

// The site invite links point to: this page's own on web, under its base path on a PR preview
// (/pr-<n>); on native, the stage's site (android.yml) or the local Expo web server.
const WEB_URL =
  Platform.OS === 'web'
    ? `${window.location.origin}${process.env.EXPO_BASE_URL ?? ''}`
    : (process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:8081');

/** Shares the invite link; where the browser can't share, copies it. */
async function shareLink(url: string) {
  try {
    await Share.share(invitePayload(url, Platform.OS));
  } catch (e) {
    // Closing the share sheet isn't a failure: don't copy behind the user's back.
    if (e instanceof Error && e.name === 'AbortError') return;
    await navigator.clipboard?.writeText(url);
    showToast(he.people.copied);
  }
}

export function PeopleTab({ data, view, me }: { data: TripData; view: TripView; me: string }) {
  const act = useTripAction(data.trip.id);
  // `${action}:${userId}` armed by a first tap; a second tap does it.
  const [confirming, setConfirming] = useState<string>();
  const organizer = view.memberById.get(me)?.role === 'organizer';
  const pending = data.members.filter((m) => m.status === 'pending');
  const link = inviteUrl(WEB_URL, data.inviteToken);

  const taken = (userId: string) => {
    const ids = new Set(data.claims.filter((c) => c.userId === userId).map((c) => c.itemId));
    const mine = view.items.filter((i) => ids.has(i.id));
    const bring = mine.filter((i) => i.list === 'bring').length;
    const buy = mine.filter((i) => i.list === 'buy').length;
    const parts = [bring > 0 && he.people.bring(bring), buy > 0 && he.people.buy(buy)];
    return parts.filter(Boolean).join(', ') || he.people.noItems;
  };

  /** A button that asks once more before `run`. */
  const confirmButton = (
    action: string,
    userId: string,
    label: string,
    confirmLabel: string,
    run: () => void,
  ) => {
    const armed = confirming === `${action}:${userId}`;
    return (
      <PillButton
        label={armed ? confirmLabel : label}
        variant={armed ? 'danger' : 'quiet'}
        size="sm"
        onPress={() => {
          if (!armed) return setConfirming(`${action}:${userId}`);
          run();
          setConfirming(undefined);
        }}
      />
    );
  };

  const name = (m: TripMember) => (
    <View style={styles.nameRow}>
      <Text style={styles.name}>{view.nameOf(m.userId)}</Text>
      {m.role === 'organizer' && <Text style={styles.badge}>{he.people.organizer}</Text>}
    </View>
  );

  return (
    <View style={styles.wrap}>
      <Card>
        <View style={styles.texts}>
          <Text style={styles.title}>{he.people.inviteTitle}</Text>
          <Text style={styles.text}>{he.people.inviteText}</Text>
        </View>
        <PillButton
          label={he.people.share}
          variant="soft"
          wide
          icon={<Icon name="userPlus" size={18} color={colors.primaryStrong} />}
          {...testId('people-share')}
          onPress={() => shareLink(link)}
        />
        {/* The link itself too, to copy by hand where sharing doesn't reach. */}
        <Text style={styles.link} selectable numberOfLines={1} {...testId('people-invite-link')}>
          {link}
        </Text>
      </Card>

      {organizer && pending.length > 0 && (
        <ListGroup title={he.people.pending}>
          {pending.map((m) => (
            <View key={m.userId} style={styles.person}>
              <Avatar person={toAvatar(m)} size={44} />
              <View style={styles.personBody}>{name(m)}</View>
              <PillButton
                label={he.people.approve}
                size="sm"
                {...testId('people-approve')}
                onPress={() => act({ type: 'approveMember', userId: m.userId })}
              />
              {confirmButton('decline', m.userId, he.people.decline, he.people.confirmDecline, () =>
                act({ type: 'declineMember', userId: m.userId }),
              )}
            </View>
          ))}
        </ListGroup>
      )}

      <ListGroup title={participants(view.activeIds.length)}>
        {view.active.map((m) => {
          return (
            <View key={m.userId} style={styles.person}>
              <Avatar person={toAvatar(m)} size={44} />
              <View style={styles.personBody}>
                {name(m)}
                <Text style={styles.chipText}>{taken(m.userId)}</Text>
              </View>
              {organizer &&
                m.userId !== me &&
                confirmButton('remove', m.userId, he.people.remove, he.people.confirmRemove, () => {
                  act({ type: 'removeMember', userId: m.userId });
                  showToast(he.people.removed(view.displayNameOf(m.userId)));
                })}
            </View>
          );
        })}
      </ListGroup>

      {organizer && (
        <PillButton
          label={he.deleteTrip.action}
          variant="danger"
          icon={<Icon name="trash" size={18} color={colors.brandStrong} />}
          {...testId('trip-delete')}
          onPress={() =>
            router.push({ pathname: '/trips/[tripId]/delete', params: { tripId: data.trip.id } })
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[4] },
  texts: { gap: space[1] },
  title: { ...type.itemTitle, color: colors.ink },
  text: { ...type.caption, color: colors.inkMuted },
  link: { ...type.caption, color: colors.inkMuted, textAlign: 'center', writingDirection: 'ltr' },
  person: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: space.touch },
  personBody: { flex: 1, gap: space[1] },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  name: { ...type.itemTitle, color: colors.ink },
  badge: {
    ...type.caption,
    paddingHorizontal: space[2],
    borderRadius: 999,
    backgroundColor: colors.ground,
    color: colors.inkMuted,
    overflow: 'hidden',
  },
  chipText: { ...type.caption, color: colors.inkMuted },
});
