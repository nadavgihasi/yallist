import { createElement, useState } from 'react';
import { View } from 'react-native';

import { DateTile, dateTileStyles } from '@/components/Fields';
import { formatRange } from '@/lib/dates';

type DateInput = HTMLInputElement & { showPicker?: () => void };

/**
 * Web: a native date input laid transparently over the whole tile. A click anywhere (or Enter /
 * Space) opens the browser's calendar; on its own Chrome only opens it from the tiny, hidden icon.
 */
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
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const open = (input: DateInput) => {
    try {
      input.showPicker?.();
    } catch {
      // Not allowed here (e.g. a cross-origin iframe): typing the date still works.
    }
  };
  return (
    <View
      style={[
        dateTileStyles.tile,
        (hovered || focused) && dateTileStyles.active,
        focused && dateTileStyles.focused,
      ]}
    >
      <DateTile label={label} value={value} active={hovered} focused={focused} />
      {createElement('input', {
        type: 'date',
        value,
        min,
        'aria-label': `${label}: ${formatRange(value, value)}`,
        onClick: (e: { currentTarget: DateInput }) => open(e.currentTarget),
        onKeyDown: (e: { key: string; currentTarget: DateInput; preventDefault: () => void }) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open(e.currentTarget);
          }
        },
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
        // `min` only limits the picker; typed dates still need clamping.
        onChange: (e: { target: { value: string } }) => {
          const next = e.target.value;
          if (next) onChange(min && next < min ? min : next);
        },
        style: {
          position: 'absolute',
          inset: 0,
          opacity: 0,
          width: '100%',
          height: '100%',
          margin: 0,
          cursor: 'pointer',
          border: 'none',
        },
      })}
    </View>
  );
}
