import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { ListGroup, SectionHeader } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { showToast } from '@/components/Toast';
import { he, participants } from '@/i18n/he';
import { useTripAction } from '@/state/trips';
import type { TripData, TripMember } from '@/state/types';
import { colors, fonts, radius } from '@/theme';

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
      <View style={styles.card}>
        <View style={styles.texts}>
          <Text style={styles.title}>{he.people.inviteTitle}</Text>
          <Text style={styles.text}>{he.people.inviteText}</Text>
        </View>
        <PillButton
          label={he.people.share}
          variant="soft"
          size="lg"
          wide
          onPress={() => shareLink(Linking.createURL(`/j/${data.inviteToken}`))}
        />
      </View>

      {organizer && pending.length > 0 && (
        <>
          <SectionHeader title={he.people.pending} />
          <ListGroup inset={72}>
            {pending.map((m) => (
              <View key={m.userId} style={styles.person}>
                <Avatar person={toAvatar(m, me)} size={44} />
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
        </>
      )}

      <SectionHeader title={participants(view.activeIds.length)} />
      <ListGroup inset={72}>
        {view.active.map((m) => {
          const c = counts(m.userId);
          const confirming = confirmRemove === m.userId;
          return (
            <View key={m.userId} style={styles.person}>
              <Avatar person={toAvatar(m, me)} size={44} />
              <View style={styles.personBody}>
                {name(m)}
                <View style={styles.chips}>
                  <View style={[styles.pill, styles.chip]}>
                    <Text style={styles.chipText}>{he.people.bring(c.bring)}</Text>
                  </View>
                  <View style={[styles.pill, styles.chip]}>
                    <Text style={styles.chipText}>{he.people.buy(c.buy)}</Text>
                  </View>
                </View>
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
  wrap: { paddingTop: 20, paddingHorizontal: 16, gap: 16 },
  card: { padding: 20, borderRadius: radius.group, backgroundColor: colors.surface, gap: 14 },
  texts: { gap: 4 },
  title: { fontFamily: fonts.display, fontSize: 21, color: colors.ink },
  text: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.inkSecondary },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  personBody: { flex: 1, gap: 6 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink },
  pill: { backgroundColor: colors.ground, justifyContent: 'center' },
  badge: { height: 22, paddingHorizontal: 8, borderRadius: 11 },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { height: 24, paddingHorizontal: 10, borderRadius: 12 },
  chipText: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkSecondary },
});
