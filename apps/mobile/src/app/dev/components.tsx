import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AvatarStack, type AvatarPerson } from '@/components/Avatar';
import { FilterChip, PersonChip, SuggestionChip } from '@/components/Chips';
import { SegmentedControl, Switch } from '@/components/Controls';
import { Cover, type Scene } from '@/components/Cover';
import { AmountField, TextField } from '@/components/Fields';
import { FloatingAction } from '@/components/FloatingAction';
import { Icon } from '@/components/Icon';
import { Card, EmptyState, ListGroup } from '@/components/ListGroup';
import { Logo } from '@/components/Logo';
import { PillButton } from '@/components/PillButton';
import { Progress } from '@/components/Progress';
import { StatusRing } from '@/components/StatusRing';
import { TripTile } from '@/components/TripTile';
import { colors, space, type } from '@/theme';

const PEOPLE: AvatarPerson[] = ['ד', 'מ', 'ר', 'ש', 'א', 'י'].map((initial) => ({ initial }));
const SCENES: Scene[] = ['camp', 'grill', 'zimmer', 'beach', 'blank'];

/** Dev-only gallery of the design-system components. */
export default function ComponentsPreview() {
  const [filter, setFilter] = useState('all');
  const [list, setList] = useState<'bring' | 'buy'>('bring');
  const [on, setOn] = useState(true);
  const [amount, setAmount] = useState('120');

  if (!__DEV__) return <Redirect href="/" />;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Logo />
        <Text style={styles.h1}>רכיבים</Text>

        <View style={styles.row}>
          {SCENES.map((s) => (
            <TripTile key={s} template={s} />
          ))}
        </View>
        <Cover scene="camp" style={styles.cover} />

        <Card>
          <Progress done={9} total={20} />
          <AvatarStack people={PEOPLE} />
          <View style={styles.row}>
            <StatusRing state="open" />
            <StatusRing state="held" />
            <StatusRing state="done" label="נקנה" />
          </View>
        </Card>

        <View style={styles.row}>
          <PillButton label="אני אביא" variant="soft" />
          <PillButton label="ביטול" variant="quiet" icon={<Icon name="close" size={16} />} />
          <PillButton
            label="יש לי"
            icon={<Icon name="check" size={16} color={colors.onPrimary} />}
          />
        </View>
        <PillButton label="יצירת הטיול" size="lg" wide />
        <PillButton label="מחיקת הפריט" variant="danger" />

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
        <SegmentedControl
          options={[
            { value: 'bring', label: 'להביא · 20' },
            { value: 'buy', label: 'לקנות · 7' },
          ]}
          value={list}
          onChange={setList}
        />
        <Card>
          <View style={styles.row}>
            <PersonChip person={PEOPLE[0]!} name="דנה" selected={on} onPress={() => setOn(!on)} />
            <SuggestionChip label="מלקחיים" onPress={() => {}} />
          </View>
          <View style={styles.row}>
            <Text style={styles.body}>אני אביא את זה</Text>
            <Switch value={on} onChange={setOn} label="אני אביא את זה" />
          </View>
          <TextField label="שם הטיול" placeholder="למשל: קמפינג בכנרת" />
          <AmountField label="כמה?" value={amount} onChangeText={setAmount} />
        </Card>

        <ListGroup title="ציוד" aside="חסר 1">
          <Text style={styles.body}>מנגל</Text>
          <Text style={styles.body}>פחמים</Text>
        </ListGroup>
        <EmptyState title="אין כאן מה שחסר" text="כל הפריטים ברשימה הזו מכוסים." />
        <View style={styles.spacer} />
      </ScrollView>
      <FloatingAction label="פריט חדש" onPress={() => {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: {
    padding: space.screen,
    paddingTop: 48,
    gap: space[4],
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  h1: { ...type.pageTitle, color: colors.ink },
  cover: { height: 160, borderRadius: 24 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], alignItems: 'center' },
  body: { ...type.body, color: colors.ink, flex: 1 },
  spacer: { height: 120 },
});
