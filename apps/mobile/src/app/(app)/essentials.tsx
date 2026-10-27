import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Input } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { Card } from '@/components/ListGroup';
import { PillButton } from '@/components/PillButton';
import { Skeleton } from '@/components/Skeleton';
import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { useEssentials, useSetEssentials } from '@/state/essentials';
import { colors, size, space, type } from '@/theme';

/** Same limit as the API's. */
const MAX_NAME = 60;

/**
 * הקבועים שלי (packing spec §6.4): what I always pack, copied into my bag in every trip I create or
 * join from now on. Each change saves the whole list; trips I'm already in keep what they have.
 */
export default function EssentialsScreen() {
  const insets = useSafeAreaInsets();
  const query = useEssentials();
  const save = useSetEssentials();
  const [name, setName] = useState('');
  // The essential whose delete was tapped once; a second tap deletes it.
  const [confirming, setConfirming] = useState<string>();
  const names = query.data?.essentials ?? [];

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Already there (ignoring case): nothing to add.
    if (!names.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      save.mutate([...names, trimmed]);
    }
    setName('');
  };
  const move = (from: number, to: number) => {
    const next = [...names];
    next.splice(to, 0, ...next.splice(from, 1));
    save.mutate(next);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: 12 + insets.top, paddingBottom: 32 + insets.bottom },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={he.essentials.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={styles.back}
        >
          <Icon name="back" strokeWidth={2.5} />
        </Pressable>
        <View style={styles.titles}>
          <Text style={styles.h1} accessibilityRole="header" {...testId('essentials-title')}>
            {he.essentials.title}
          </Text>
          <Text style={styles.caption}>{he.essentials.caption}</Text>
        </View>
      </View>

      {query.data ? (
        <Card gap={space[2]}>
          {names.length === 0 && <Text style={styles.caption}>{he.essentials.empty}</Text>}
          {names.map((n, i) => {
            const armed = confirming === n;
            return (
              <View key={n} style={styles.row}>
                <Text style={styles.name} numberOfLines={2}>
                  {n}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={he.essentials.up(n)}
                  disabled={i === 0}
                  onPress={() => move(i, i - 1)}
                  style={[styles.icon, i === 0 && styles.disabled]}
                >
                  <Icon name="chevronUp" size={20} color={colors.primaryStrong} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={he.essentials.down(n)}
                  disabled={i === names.length - 1}
                  onPress={() => move(i, i + 1)}
                  style={[styles.icon, i === names.length - 1 && styles.disabled]}
                >
                  <Icon name="chevronDown" size={20} color={colors.primaryStrong} />
                </Pressable>
                <PillButton
                  label={armed ? he.essentials.confirmDelete : he.essentials.delete}
                  accessibilityLabel={armed ? undefined : he.essentials.deleteLabel(n)}
                  variant={armed ? 'danger' : 'quiet'}
                  size="sm"
                  {...testId('essentials-delete')}
                  onPress={() => {
                    if (!armed) return setConfirming(n);
                    save.mutate(names.filter((x) => x !== n));
                    setConfirming(undefined);
                  }}
                />
              </View>
            );
          })}
          <View style={styles.addRow}>
            <Input
              value={name}
              onChangeText={setName}
              placeholder={he.essentials.placeholder}
              accessibilityLabel={he.essentials.name}
              maxLength={MAX_NAME}
              returnKeyType="done"
              onSubmitEditing={add}
              {...testId('essentials-name')}
              style={styles.input}
            />
            <PillButton
              label={he.essentials.add}
              variant="soft"
              disabled={!name.trim()}
              {...testId('essentials-add')}
              onPress={add}
            />
          </View>
        </Card>
      ) : (
        <Skeleton style={styles.content}>
          <Skeleton.Card>
            <Skeleton.Line width="50%" />
            <Skeleton.Line width="40%" />
          </Skeleton.Card>
        </Skeleton>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    paddingHorizontal: space.screen,
    gap: space[4],
  },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  back: {
    width: size.avatar,
    height: size.avatar,
    borderRadius: size.avatar / 2,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flexShrink: 1, gap: 2 },
  h1: { ...type.pageTitle, color: colors.ink },
  caption: { ...type.caption, color: colors.inkMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[1], minHeight: space.touch },
  name: { ...type.itemTitle, color: colors.ink, flex: 1, minWidth: 0 },
  icon: {
    width: space.touch,
    height: space.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.3 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingTop: space[2] },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: size.buttonSm,
    paddingHorizontal: space[4],
    borderRadius: 999,
    backgroundColor: colors.ground,
    color: colors.ink,
    ...type.body,
  },
});
