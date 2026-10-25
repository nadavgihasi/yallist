import type { ListKind } from '@yallist/domain';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TextField } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { he } from '@/i18n/he';
import { useTrip, useTripAction } from '@/state/trips';
import { colors, fonts } from '@/theme';

/**
 * Adds a category to `list`, or, given `categoryId`, renames, moves or deletes it. Deleting a
 * category with items asks once more: its items stay, uncategorized.
 */
export function CategoryForm({
  tripId,
  list = 'bring',
  categoryId,
  onClose,
}: {
  tripId: string;
  list?: ListKind;
  categoryId?: string;
  /** Closes the sheet, first running `then` (the change), once even if tapped twice. */
  onClose: (then?: () => void) => void;
}) {
  const data = useTrip(tripId);
  const act = useTripAction(tripId);
  const category = data?.categories.find((c) => c.id === categoryId);
  const [name, setName] = useState(category?.name ?? '');
  const [confirming, setConfirming] = useState(false);
  if (!data) return null;

  const trimmed = name.trim();
  const save = () => {
    if (!trimmed) return;
    onClose(() => {
      if (!category) act({ type: 'addCategory', list, name: trimmed });
      else if (trimmed !== category.name) {
        act({ type: 'renameCategory', categoryId: category.id, name: trimmed });
      }
    });
  };

  const siblings = category
    ? data.categories
        .filter((c) => c.list === category.list)
        .sort((a, b) => a.position - b.position)
        .map((c) => c.id)
    : [];
  const index = category ? siblings.indexOf(category.id) : -1;
  // Guards rather than `category!`: the React Compiler reads such paths during render.
  const move = (by: -1 | 1) => {
    if (!category) return;
    const order = [...siblings];
    [order[index], order[index + by]] = [order[index + by]!, order[index]!];
    act({ type: 'reorderCategories', list: category.list, categoryIds: order });
  };

  const itemCount = category ? data.items.filter((i) => i.categoryId === category.id).length : 0;
  const remove = () => {
    if (!category) return;
    if (itemCount > 0 && !confirming) return setConfirming(true);
    onClose(() => act({ type: 'deleteCategory', categoryId: category.id }));
  };

  return (
    <Sheet
      title={category ? he.category.editTitle : he.category.newTitle}
      onClose={onClose}
      footer={
        <>
          <PillButton
            label={category ? he.category.save : he.category.add}
            size="lg"
            wide
            disabled={!trimmed}
            onPress={save}
          />
          {category && (
            <PillButton
              label={confirming ? he.category.confirmDelete : he.category.delete}
              variant="danger"
              icon={<Icon name="trash" size={18} color={colors.brandStrong} />}
              onPress={remove}
            />
          )}
          {confirming && <Text style={styles.hint}>{he.category.keepsItems(itemCount)}</Text>}
        </>
      }
    >
      <TextField
        label={he.category.name}
        value={name}
        onChangeText={setName}
        onSubmitEditing={save}
        returnKeyType="done"
        placeholder={he.category.placeholder}
        maxLength={40}
        autoFocus={!category}
      />
      {category && siblings.length > 1 && (
        <View style={styles.moves}>
          <PillButton
            label={he.category.moveUp}
            variant="soft"
            disabled={index <= 0}
            onPress={() => move(-1)}
          />
          <PillButton
            label={he.category.moveDown}
            variant="soft"
            disabled={index >= siblings.length - 1}
            onPress={() => move(1)}
          />
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  moves: { flexDirection: 'row', gap: 8 },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: 'center',
  },
});
