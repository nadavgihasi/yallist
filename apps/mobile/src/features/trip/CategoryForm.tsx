import type { ListKind } from '@yallist/domain';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';

import { fieldStyles, TextField } from '@/components/Fields';
import { Icon } from '@/components/Icon';
import { PillButton } from '@/components/PillButton';
import { Sheet } from '@/components/Sheet';
import { he } from '@/i18n/he';
import { useTrip, useTripAction } from '@/state/trips';
import { accents, colors, fonts, size, space } from '@/theme';

type WebState = PressableStateCallbackType & { hovered?: boolean; focused?: boolean };

/**
 * Adds a category to `list`, or, given `categoryId`, renames, recolors, moves or deletes it.
 * Deleting a category with items asks once more: its items stay, uncategorized.
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
  // null: not picked here, so the color it has (picked before, or of its place on the list).
  const [picked, setPicked] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  if (!data) return null;

  const siblings = data.categories
    .filter((c) => c.list === (category?.list ?? list))
    .sort((a, b) => a.position - b.position)
    .map((c) => c.id);
  const index = category ? siblings.indexOf(category.id) : -1;
  // The color its card has now; a new category goes last on the list.
  const current = category?.color ?? (category ? index : siblings.length) % accents.length;
  const shownColor = picked ?? current;

  const trimmed = name.trim();
  const save = () => {
    if (!trimmed) return;
    onClose(() => {
      if (!category) {
        act({
          type: 'addCategory',
          list,
          name: trimmed,
          ...(picked !== null && { color: picked }),
        });
        return;
      }
      const renamed = trimmed !== category.name;
      const recolored = picked !== null && picked !== current;
      if (renamed || recolored) {
        act({
          type: 'editCategory',
          categoryId: category.id,
          ...(renamed && { name: trimmed }),
          ...(recolored && { color: picked }),
        });
      }
    });
  };
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
      <View style={styles.colorField}>
        <Text style={fieldStyles.label}>{he.category.color}</Text>
        <View
          style={styles.swatches}
          accessibilityRole="radiogroup"
          accessibilityLabel={he.category.color}
        >
          {accents.map((accent, i) => {
            const selected = i === shownColor;
            return (
              <Pressable
                key={accent}
                accessibilityRole="radio"
                accessibilityLabel={he.category.colorNames[i]}
                accessibilityState={{ checked: selected }}
                onPress={() => setPicked(i)}
                style={(state: WebState) => [
                  styles.swatch,
                  state.hovered && styles.swatchHover,
                  selected && { borderColor: accent },
                  state.focused && styles.focus,
                ]}
              >
                <View style={[styles.swatchFill, { backgroundColor: accent }]}>
                  {selected && <Icon name="check" size={18} color={colors.card} strokeWidth={3} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
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
  colorField: { gap: 8 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  // 44px: a full touch target.
  swatch: {
    width: size.avatar,
    height: size.avatar,
    borderRadius: size.avatar / 2,
    borderWidth: 2,
    borderColor: 'transparent',
    padding: 3,
  },
  swatchHover: { borderColor: colors.line },
  swatchFill: {
    flex: 1,
    borderRadius: size.avatar / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focus: { outlineColor: colors.primary, outlineStyle: 'solid', outlineWidth: 2, outlineOffset: 2 },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.inkMuted,
    textAlign: 'center',
  },
});
