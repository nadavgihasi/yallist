import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Pressable } from 'react-native';

import { DateTile, dateTileStyles } from '@/components/Fields';
import { he } from '@/i18n/he';
import { formatRange, parseDate, toISODate } from '@/lib/dates';

/** Android: the whole tile opens the system calendar. The web build uses DateField.web.tsx. */
export function DateField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: string;
  min?: string;
  onChange: (iso: string) => void;
}) {
  const open = () =>
    DateTimePickerAndroid.open({
      mode: 'date',
      value: parseDate(value),
      minimumDate: min ? parseDate(min) : undefined,
      onChange: (event, date) => {
        if (event.type === 'set' && date) onChange(toISODate(date));
      },
    });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${formatRange(value, value)}`}
      accessibilityHint={he.dates.pickHint}
      onPress={open}
      style={({ pressed }) => [dateTileStyles.tile, pressed && dateTileStyles.active]}
    >
      {({ pressed }) => <DateTile label={label} value={value} active={pressed} />}
    </Pressable>
  );
}
