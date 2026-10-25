import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/theme';

/**
 * Rounded-stroke icons on a 24px grid: the handoff's set (docs/design/icons), the rest adapted from
 * Lucide (ISC). Directional ones are drawn for RTL.
 */
const ICONS = {
  /** chevron-right: "back" in RTL. */
  back: ['M9 5l7 7-7 7'],
  /** A row that opens something, pointing the reading direction (left in RTL). */
  chevronEnd: ['M15 5l-7 7 7 7'],
  arrowEnd: ['M19 12H5', 'M11 6l-6 6 6 6'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  check: ['M5 12.5l4.5 4.5L19 7'],
  close: ['M18 6 6 18', 'M6 6l12 12'],
  pencil: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z'],
  calendar: [
    'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
    'M16 2v4',
    'M8 2v4',
    'M3 10h18',
  ],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  settings: [
    'M4 21v-7',
    'M4 10V3',
    'M12 21v-9',
    'M12 8V3',
    'M20 21v-5',
    'M20 12V3',
    'M1 14h6',
    'M9 8h6',
    'M17 16h6',
  ],
  userPlus: ['M15 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1', 'M19 8v6', 'M16 11h6'],
  bring: [
    'M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z',
    'M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2',
    'M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5',
  ],
  // Trip tiles.
  tent: ['M3.5 20 12 5l8.5 15', 'M9 20l3-5.5 3 5.5', 'M2 20h20'],
  mountain: ['M2.5 19 9 8l4 6.5 2.5-3.5 6 8z'],
  sun: [
    'M12 2.5v2',
    'M12 19.5v2',
    'M2.5 12h2',
    'M19.5 12h2',
    'M5.3 5.3l1.4 1.4',
    'M17.3 17.3l1.4 1.4',
    'M5.3 18.7l1.4-1.4',
    'M17.3 6.7l1.4-1.4',
  ],
  flame: [
    'M12 3c.5 3 4 5 4 9.5a4 4 0 0 1-8 0c0-2 1-3.5 2-4.5 0 2 .8 3 2 3.5 0-3-1-5 0-8.5z',
    'M5 21h14',
  ],
  trash: [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  ],
} as const;

const CIRCLES: Partial<Record<IconName, { cx: number; cy: number; r: number }[]>> = {
  userPlus: [{ cx: 9, cy: 7.5, r: 3.5 }],
  sun: [{ cx: 12, cy: 12, r: 4 }],
};

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 22,
  color = colors.ink,
  strokeWidth = 2.25,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICONS[name].map((d) => (
        <Path key={d} d={d} />
      ))}
      {CIRCLES[name]?.map((c) => (
        <Circle key={`${c.cx}-${c.cy}`} {...c} />
      ))}
    </Svg>
  );
}
