import { COVER_IDS, type CoverId } from '@yallist/domain';
import { Pressable, StyleSheet, View } from 'react-native';

import { Cover } from './Cover';
import { Icon } from './Icon';

import { he } from '@/i18n/he';
import { testId } from '@/lib/testId';
import { colors, space } from '@/theme';

/** The ten covers as a grid of thumbnails, one of them picked. */
export function CoverPicker({
  value,
  onChange,
}: {
  value: CoverId;
  onChange: (cover: CoverId) => void;
}) {
  return (
    <View
      style={styles.grid}
      accessibilityRole="radiogroup"
      accessibilityLabel={he.cover.title}
      {...testId('trip-cover-picker')}
    >
      {COVER_IDS.map((id) => {
        const selected = id === value;
        return (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityLabel={he.cover.names[id]}
            accessibilityState={{ checked: selected }}
            {...testId(`trip-cover-${id}`)}
            onPress={() => onChange(id)}
            style={({ pressed }) => [
              styles.thumb,
              selected && styles.selected,
              pressed && styles.pressed,
            ]}
          >
            <Cover scene={id} style={StyleSheet.absoluteFill} />
            {selected && (
              <View style={styles.check}>
                <Icon name="check" size={14} strokeWidth={3} color={colors.onPrimary} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Five a row: 5 × 18% plus 4 gaps of 6 fits any column wider than 240.
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space[2], columnGap: 6 },
  // At least 48 tall, so a phone's 60-wide thumbnail is still a 44+ target.
  thumb: {
    width: '18%',
    minHeight: 48,
    aspectRatio: 4 / 3,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  selected: { borderColor: colors.primary },
  pressed: { opacity: 0.75 },
  check: {
    position: 'absolute',
    top: 4,
    end: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
