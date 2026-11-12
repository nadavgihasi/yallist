import { router } from 'expo-router';
import { useState, type ComponentRef, type Ref } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { Card, ListGroup } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { showToast } from '@/components/Toast';
import { he, participants, removeWarning } from '@/i18n/he';
import { formatRange } from '@/lib/dates';
import { invitePayload, inviteUrl } from '@/lib/invite';
import { testId } from '@/lib/testId';
import { useExitTrip, useTripAction } from '@/state/trips';
import type { TripData, TripMember } from '@/state/types';
import { colors, space, type } from '@/theme';

import { toAvatar, type TripView } from './derive';
import { AlbumSection, MeetupSection } from './TripLinks';

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

export function PeopleTab({
  data,
  view,
  me,
  shareRef,
}: {
  data: TripData;
  view: TripView;
  me: string;
  /** Lets the trip screen scroll the share button to the middle of the page. */
  shareRef?: Ref<ComponentRef<typeof View>>;
}) {
  const act = useTripAction(data.trip.id);
  // `${action}:${userId}` armed by a first tap; a second tap does it.
  const [confirming, setConfirming] = useState<string>();
  const organizer = view.memberById.get(me)?.role === 'organizer';
  const exit = useExitTrip(data.trip.id);
  // The only organizer can't leave: the trip would have no one to run it (the API checks too).
  const onlyOrganizer = organizer && view.active.filter((m) => m.role === 'organizer').length === 1;
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
        <View ref={shareRef} collapsable={false}>
          <PillButton
            label={he.people.share}
            variant="soft"
            wide
            icon={<Icon name="userPlus" size={18} color={colors.primaryStrong} />}
            {...testId('people-share')}
            onPress={() => shareLink(link)}
          />
        </View>
        {/* The link itself too, to copy by hand where sharing doesn't reach. */}
        <Text style={styles.link} selectable numberOfLines={1} {...testId('people-invite-link')}>
          {link}
        </Text>
      </Card>

      {organizer && (
        <Card gap={space[3]}>
          <View style={styles.nameRow}>
            <Icon name="calendar" size={20} color={colors.inkMuted} />
            <View style={styles.personBody}>
              <Text style={styles.title} {...testId('trip-details-name')}>
                {data.trip.name}
              </Text>
              <Text style={styles.text}>{formatRange(data.trip.startsOn, data.trip.endsOn)}</Text>
            </View>
            <PillButton
              label={he.links.edit}
              accessibilityLabel={he.renameTrip.edit}
              variant="quiet"
              size="sm"
              icon={<Icon name="pencil" size={16} color={colors.inkMuted} />}
              {...testId('trip-rename-edit')}
              onPress={() =>
                router.push({
                  pathname: '/trips/[tripId]/rename',
                  params: { tripId: data.trip.id },
                })
              }
            />
          </View>
        </Card>
      )}

      <MeetupSection trip={data.trip} organizer={organizer} />
      <AlbumSection trip={data.trip} organizer={organizer} />

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
          const removing = confirming === `remove:${m.userId}`;
          return (
            <View key={m.userId} style={styles.member}>
              <View style={styles.person}>
                <Avatar person={toAvatar(m)} size={44} />
                <View style={styles.personBody}>
                  {name(m)}
                  <Text style={styles.chipText}>{taken(m.userId)}</Text>
                </View>
                {organizer && m.userId !== me && !removing && (
                  <PillButton
                    label={he.people.remove}
                    variant="quiet"
                    size="sm"
                    {...testId('people-remove')}
                    onPress={() => setConfirming(`remove:${m.userId}`)}
                  />
                )}
              </View>
              {/* Removing asks first, saying what they owe or are owed: they lose access to it. */}
              {removing && (
                <View style={styles.confirm}>
                  <Text
                    style={styles.text}
                    accessibilityRole="alert"
                    {...testId('people-remove-warning')}
                  >
                    {removeWarning(view.displayNameOf(m.userId), data.balances[m.userId] ?? 0)}
                  </Text>
                  <View style={styles.actions}>
                    <PillButton
                      label={he.people.confirmRemove}
                      variant="danger"
                      size="sm"
                      {...testId('people-remove-confirm')}
                      onPress={() => {
                        act({ type: 'removeMember', userId: m.userId });
                        showToast(he.people.removed(view.displayNameOf(m.userId)));
                        setConfirming(undefined);
                      }}
                    />
                    <PillButton
                      label={he.profile.cancel}
                      variant="quiet"
                      size="sm"
                      onPress={() => setConfirming(undefined)}
                    />
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </ListGroup>

      {onlyOrganizer ? (
        <Text style={styles.text}>{he.leaveTrip.lastOrganizer}</Text>
      ) : confirming === 'leave' ? (
        <Card gap={space[3]}>
          <Text style={styles.text} accessibilityRole="alert">
            {he.leaveTrip.warning}
          </Text>
          <View style={styles.actions}>
            <PillButton
              label={he.leaveTrip.confirm}
              variant="danger"
              disabled={exit.isPending}
              {...testId('trip-leave-confirm')}
              onPress={() => exit.mutate()}
            />
            <PillButton
              label={he.profile.cancel}
              variant="quiet"
              onPress={() => setConfirming(undefined)}
            />
          </View>
        </Card>
      ) : (
        <PillButton
          label={he.leaveTrip.action}
          variant="quiet"
          {...testId('trip-leave')}
          onPress={() => setConfirming('leave')}
        />
      )}

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
  actions: { flexDirection: 'row', gap: space[2] },
  texts: { gap: space[1] },
  title: { ...type.itemTitle, color: colors.ink },
  text: { ...type.caption, color: colors.inkMuted },
  link: { ...type.caption, color: colors.inkMuted, textAlign: 'center', writingDirection: 'ltr' },
  member: { gap: space[2] },
  confirm: { gap: space[2], paddingStart: 44 + space[3] },
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
