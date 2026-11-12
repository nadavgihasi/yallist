import type { Claim, Item } from '@yallist/domain';
import { StyleSheet, Text, View } from 'react-native';

import { PersonChip } from '@/components/Chips';
import { fieldStyles } from '@/components/Fields';
import { he } from '@/i18n/he';
import { colors, fonts } from '@/theme';

import { assignTap, type Assignment } from './assign';
import type { TripView } from './derive';

/**
 * "מי מביא?": the trip's active members as chips, the ones who have the item selected. Tapping
 * one assigns the item to them (moving a single item from whoever had it), tapping again takes it
 * off them. A qty item shows how many each one brings.
 */
export function AssignPicker({
  item,
  claims,
  view,
  me,
  onAssign,
}: {
  item: Item;
  claims: readonly Claim[];
  view: TripView;
  me: string;
  onAssign: (assignment: Assignment) => void;
}) {
  const quantityOf = (id: string) =>
    claims.find((c) => c.itemId === item.id && c.userId === id)?.quantity ?? 0;
  const title = item.list === 'buy' ? he.item.whoBuys : he.item.whoBrings;
  const mine = claims.find((c) => c.itemId === item.id && c.userId === me);
  const full =
    item.kind === 'qty' &&
    view.activeIds.some((id) => quantityOf(id) === 0 && !assignTap(item, claims, id, me));
  const hint =
    mine?.assignedBy && mine.assignedBy !== me
      ? he.item.assignedBy(view.displayNameOf(mine.assignedBy))
      : full
        ? he.item.assignFull
        : he.item.assignHint;
  return (
    <View style={styles.wrap}>
      <Text style={fieldStyles.label}>{title}</Text>
      <View style={styles.chips} accessibilityLabel={title}>
        {view.activeIds.map((id) => {
          const quantity = quantityOf(id);
          const name = view.nameOf(id);
          return (
            <PersonChip
              key={id}
              person={view.avatarOf(id)}
              name={
                item.kind === 'qty' && quantity > 0
                  ? he.item.assignedQuantity(name, quantity)
                  : name
              }
              selected={quantity > 0}
              onPress={() => {
                const assignment = assignTap(item, claims, id, me);
                if (assignment) onAssign(assignment);
              }}
            />
          );
        })}
      </View>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkMuted },
});
