import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AvatarStack, type AvatarPerson } from '@/components/Avatar';
import { FilterChip, PersonChip, SuggestionChip } from '@/components/Chips';
import { SegmentedControl, Switch } from '@/components/Controls';
import { Cover, type Scene } from '@/components/Cover';
import { AmountField, TextField } from '@/components/Fields';
import { Fab, GlassTabBar } from '@/components/GlassTabBar';
import { Icon } from '@/components/Icon';
import { EmptyState, ListGroup, SectionHeader } from '@/components/ListGroup';
import { Pegs } from '@/components/Pegs';
import { PillButton } from '@/components/PillButton';
import { avatarPalette, colors, fonts } from '@/theme';

const PEOPLE: AvatarPerson[] = ['ד', 'מ', 'ר', 'ש', 'א', 'י'].map((initial, i) => ({
  initial,
  color: avatarPalette[i % avatarPalette.length]!,
}));
const SCENES: Scene[] = ['camp', 'grill', 'zimmer', 'beach', 'blank'];

/** Dev-only gallery of the design-system components. */
export default function ComponentsPreview() {
  const [filter, setFilter] = useState('all');
  const [list, setList] = useState<'bring' | 'buy'>('bring');
  const [on, setOn] = useState(true);
  const [tab, setTab] = useState<'bring' | 'buy' | 'people' | 'money'>('bring');
  const [amount, setAmount] = useState('120');

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h1}>רכיבים</Text>

        <SectionHeader title="כיסויים" />
        {SCENES.map((s) => (
          <Cover key={s} scene={s} style={styles.cover} />
        ))}

        <SectionHeader title="התקדמות ואווטרים" aside="חסרים 3" asideColor={colors.missing} />
        <Pegs done={9} total={20} />
        <AvatarStack people={[{ initial: 'י', color: '', isMe: true }, ...PEOPLE]} />

        <SectionHeader title="כפתורים" />
        <View style={styles.row}>
          <PillButton label="אני אביא" variant="soft" />
          <PillButton label="ביטול" variant="quiet" icon={<Icon name="close" size={16} />} />
          <PillButton label="יש לי" icon={<Icon name="check" size={16} color={colors.white} />} />
        </View>
        <PillButton label="יצירת הטיול" size="xl" wide />
        <PillButton label="מחיקת הפריט" variant="danger" />

        <SectionHeader title="צ׳יפים ובקרות" />
        <View style={styles.row}>
          {[
            ['all', 'הכול', 20],
            ['missing', 'חסר', 11],
            ['mine', 'אצלי', 2],
          ].map(([value, label, count]) => (
            <FilterChip
              key={value}
              label={String(label)}
              count={Number(count)}
              selected={filter === value}
              onPress={() => setFilter(String(value))}
            />
          ))}
        </View>
        <View style={styles.row}>
          <PersonChip person={PEOPLE[0]!} name="דנה" selected={on} onPress={() => setOn(!on)} />
          <SuggestionChip label="מלקחיים" onPress={() => {}} />
        </View>
        <SegmentedControl
          options={[
            { value: 'bring', label: 'להביא' },
            { value: 'buy', label: 'לקנות' },
          ]}
          value={list}
          onChange={setList}
        />
        <View style={styles.row}>
          <Text style={styles.body}>אני אביא את זה</Text>
          <Switch value={on} onChange={setOn} label="אני אביא את זה" />
        </View>

        <SectionHeader title="שדות" />
        <TextField label="שם הטיול" placeholder="למשל: קמפינג בכנרת" />
        <AmountField label="כמה?" value={amount} onChangeText={setAmount} />

        <SectionHeader title="רשימה" />
        <ListGroup>
          <Text style={styles.rowText}>מנגל</Text>
          <Text style={styles.rowText}>פחמים</Text>
          <Text style={styles.rowText}>צידניות</Text>
        </ListGroup>
        <EmptyState title="אין כאן מה שחסר" text="כל הפריטים ברשימה הזו מכוסים." />
        <View style={styles.spacer} />
      </ScrollView>
      <GlassTabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'bring', label: 'להביא', icon: 'bring', badge: 6 },
          { value: 'buy', label: 'לקנות', icon: 'buy', badge: 5 },
          { value: 'people', label: 'אנשים', icon: 'users' },
          { value: 'money', label: 'כסף', icon: 'wallet' },
        ]}
      />
      <Fab
        label="הוספה"
        icon={<Icon name="plus" color={colors.white} size={28} />}
        onPress={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: {
    padding: 16,
    paddingTop: 48,
    gap: 16,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  h1: { fontFamily: fonts.displayBold, fontSize: 36, color: colors.ink },
  cover: { height: 160, borderRadius: 28 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  body: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink, flex: 1 },
  rowText: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink, padding: 16 },
  spacer: { height: 120 },
});
