import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { ListGroup, SectionHeader } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { he } from '@/i18n/he';
import { newId } from '@/lib/id';
import { useDispatch } from '@/state/store';
import type { TripData } from '@/state/types';
import { colors, fonts, radius } from '@/theme';

import { toAvatar, type TripView } from './derive';

export function PeopleTab({ data, view, me }: { data: TripData; view: TripView; me: string }) {
  const dispatch = useDispatch();
  const [name, setName] = useState('');

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    dispatch({ type: 'addMember', tripId: data.trip.id, userId: newId(), name: trimmed });
    setName('');
  };

  const counts = (userId: string) => {
    const ids = new Set(data.claims.filter((c) => c.userId === userId).map((c) => c.itemId));
    const mine = view.items.filter((i) => ids.has(i.id));
    return {
      bring: mine.filter((i) => i.list === 'bring').length,
      buy: mine.filter((i) => i.list === 'buy').length,
    };
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.texts}>
          <Text style={styles.title}>{he.people.addTitle}</Text>
          <Text style={styles.text}>{he.people.addText}</Text>
        </View>
        <View style={styles.addRow}>
          <TextInput
            value={name}
            onChangeText={setName}
            onSubmitEditing={add}
            placeholder={he.people.addPlaceholder}
            placeholderTextColor={colors.inkTertiary}
            accessibilityLabel={he.people.addPlaceholder}
            style={styles.input}
          />
          <PillButton label={he.people.add} disabled={!name.trim()} onPress={add} />
        </View>
      </View>
      <SectionHeader title={he.people.count(data.members.length)} />
      <ListGroup inset={72}>
        {data.members.map((m) => {
          const c = counts(m.userId);
          return (
            <View key={m.userId} style={styles.person}>
              <Avatar person={toAvatar(m, me)} size={44} />
              <View style={styles.personBody}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{view.nameOf(m.userId)}</Text>
                  {m.role === 'organizer' && (
                    <Text style={styles.badge}>{he.people.organizer}</Text>
                  )}
                </View>
                <View style={styles.chips}>
                  <Text style={styles.chip}>{he.people.bring(c.bring)}</Text>
                  <Text style={styles.chip}>{he.people.buy(c.buy)}</Text>
                </View>
              </View>
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
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.ground,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
  },
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
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 11,
    backgroundColor: colors.ground,
    color: colors.inkSecondary,
    fontFamily: fonts.semibold,
    fontSize: 12,
    overflow: 'hidden',
  },
  chips: { flexDirection: 'row', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: colors.ground,
    color: colors.inkSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    overflow: 'hidden',
  },
});
