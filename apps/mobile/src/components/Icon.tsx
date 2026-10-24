import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/theme';

/** Stroke icons (paths adapted from Lucide, ISC). Arrows are drawn for RTL. */
const ICONS = {
  back: ['M5 12h14', 'M13 6l6 6-6 6'],
  arrowEnd: ['M19 12H5', 'M11 6l-6 6 6 6'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  check: ['M20 6 9 17l-5-5'],
  close: ['M18 6 6 18', 'M6 6l12 12'],
  pencil: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z'],
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
  userPlus: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M19 8v6', 'M22 11h-6'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  bring: [
    'M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z',
    'M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2',
    'M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5',
  ],
  buy: ['M2 2h2l2.7 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L22 7H5.1'],
  wallet: [
    'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1',
    'M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4',
  ],
  // Template tiles (NewTripV2).
  tent: ['M3 20h18', 'M12 4L4 20', 'M12 4l8 16', 'M12 13l-3 7', 'M12 13l3 7'],
  flame: [
    'M12 3c.5 3 4 5 4 9.5a4 4 0 0 1-8 0c0-2 1-3.5 2-4.5 0 2 .8 3 2 3.5 0-3-1-5 0-8.5z',
    'M5 21h14',
  ],
  house: ['M4 11l8-7 8 7', 'M6 10v10h12V10', 'M10 20v-5h4v5'],
  beach: [
    'M3 16c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0',
    'M3 20.5c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0',
  ],
  trash: [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  ],
} as const;

const CIRCLES: Partial<Record<IconName, { cx: number; cy: number; r: number }[]>> = {
  userPlus: [{ cx: 9, cy: 7, r: 4 }],
  users: [{ cx: 9, cy: 7, r: 4 }],
  beach: [{ cx: 12, cy: 8, r: 3.5 }],
  buy: [
    { cx: 8, cy: 21, r: 1 },
    { cx: 19, cy: 21, r: 1 },
  ],
};

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 22,
  color = colors.ink,
  strokeWidth = 2,
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
