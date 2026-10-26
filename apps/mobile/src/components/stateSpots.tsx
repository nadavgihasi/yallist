import type { ReactNode } from 'react';
import { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

const illo = colors.illustration;
/** The camp scene's night ink and tent flap. */
const NIGHT = '#1F1752';
const FLAP = '#E8590C';
const PALE = '#FFF4D6';

export type SpotId = 'noSignal' | 'signpost' | 'tentDoor';

/** The camp scene's sky, sun and two hills, at the spot's 160×120. */
const land = (sun?: { cx: number; cy: number; r: number }) => (
  <>
    <Rect width="160" height="120" fill={illo.sky} />
    {sun && <Circle {...sun} fill={illo.sun} />}
    <Path d="M0 74 C40 60 78 70 108 62 C128 57 144 62 160 58 V120 H0 Z" fill={illo.hill} />
    <Path d="M0 94 C48 84 100 92 160 82 V120 H0 Z" fill={illo.hillDeep} />
  </>
);

/**
 * The three state spots (load failed, not found, waiting to join), drawn on the camp scene's
 * palette (`illustration`) in the spot's 160×120 (`size.spot`). No text, so they read in RTL.
 */
export const STATE_SPOTS: Record<SpotId, ReactNode> = {
  // A tent with an antenna and empty signal bars.
  noSignal: (
    <>
      {land({ cx: 124, cy: 34, r: 15 })}
      <Path d="M80 58 V30" stroke={NIGHT} strokeWidth="3" strokeLinecap="round" />
      <Circle cx="80" cy="28" r="3.5" fill={NIGHT} />
      {[0, 1, 2].map((i) => (
        <Rect
          key={i}
          x={96 + i * 8}
          y={38 - i * 6}
          width="5"
          height={8 + i * 6}
          rx="1.5"
          fill="none"
          stroke={NIGHT}
          strokeWidth="2.5"
        />
      ))}
      <Path d="M50 104 L80 58 L110 104 Z" fill={illo.tent} />
      <Path d="M80 104 L80 74 L92 104 Z" fill={FLAP} />
    </>
  ),
  // A signpost pointing both ways at the end of a dotted trail.
  signpost: (
    <>
      {land()}
      {[
        [16, 114],
        [27, 110],
        [38, 107],
        [49, 104],
        [60, 101],
        [70, 99],
      ].map(([cx, cy]) => (
        <Circle key={cx} cx={cx} cy={cy} r="2.6" fill={PALE} />
      ))}
      <Rect x="78" y="30" width="5" height="70" rx="2.5" fill={NIGHT} />
      <Path d="M83 38 H116 L124 45 L116 52 H83 Z" fill={illo.sun} />
      <Path d="M78 58 H46 L38 65 L46 72 H78 Z" fill={illo.tent} />
    </>
  ),
  // A big tent with its door open.
  tentDoor: (
    <>
      {land({ cx: 34, cy: 30, r: 13 })}
      <Path d="M34 108 L80 44 L126 108 Z" fill={illo.tent} />
      <Path d="M80 44 L70 108 H80 Z" fill={PALE} />
      <Path d="M80 52 L80 108 H100 Z" fill={NIGHT} />
    </>
  ),
};
