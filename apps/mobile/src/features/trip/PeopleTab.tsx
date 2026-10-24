import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { Card, ListGroup } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { showToast } from '@/components/Toast';
import { he, participants } from '@/i18n/he';
import { useTripAction } from '@/state/trips';
import type { TripData, TripMember } from '@/state/types';
import { colors, space, type } from '@/theme';

import { toAvatar, type TripView } from './derive';

/** Shares the invite link; where the browser can't share, copies it. */
async function shareLink(url: string) {
  try {
    await Share.share({ message: url, url });
  } catch {
    await navigator.clipboard?.writeText(url);
    showToast(he.people.copied);
  }
}

export function PeopleTab({ data, view, me }: { data: TripData; view: TripView; me: string }) {
  const act = useTripAction(data.trip.id);
  const [confirmRemove, setConfirmRemove] = useState<string>();
  const organizer = view.memberById.get(me)?.role === 'organizer';
  const pending = data.members.filter((m) => m.status === 'pending');

  const counts = (userId: string) => {
    const ids = new Set(data.claims.filter((c) => c.userId === userId).map((c) => c.itemId));
    const mine = view.items.filter((i) => ids.has(i.id));
    return {
      bring: mine.filter((i) => i.list === 'bring').length,
      buy: mine.filter((i) => i.list === 'buy').length,
    };
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
          onPress={() => shareLink(Linking.createURL(`/j/${data.inviteToken}`))}
        />
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
                onPress={() => act({ type: 'approveMember', userId: m.userId })}
              />
              <PillButton
                label={he.people.decline}
                variant="quiet"
                size="sm"
                onPress={() => act({ type: 'declineMember', userId: m.userId })}
              />
            </View>
          ))}
        </ListGroup>
      )}

      <ListGroup title={participants(view.activeIds.length)}>
        {view.active.map((m) => {
          const c = counts(m.userId);
          const confirming = confirmRemove === m.userId;
          return (
            <View key={m.userId} style={styles.person}>
              <Avatar person={toAvatar(m)} size={44} />
              <View style={styles.personBody}>
                {name(m)}
                <Text style={styles.chipText}>
                  {he.people.bring(c.bring)} · {he.people.buy(c.buy)}
                </Text>
              </View>
              {organizer && m.userId !== me && (
                <PillButton
                  label={confirming ? he.people.confirmRemove : he.people.remove}
                  variant={confirming ? 'danger' : 'quiet'}
                  size="sm"
                  onPress={() => {
                    if (!confirming) return setConfirmRemove(m.userId);
                    act({ type: 'removeMember', userId: m.userId });
                    setConfirmRemove(undefined);
                  }}
                />
              )}
            </View>
          );
        })}
      </ListGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[4] },
  texts: { gap: space[1] },
  title: { ...type.itemTitle, color: colors.ink },
  text: { ...type.caption, color: colors.inkMuted },
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
