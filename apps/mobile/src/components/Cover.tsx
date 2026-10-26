import type { CoverId } from '@yallist/domain';
import { useState, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg from 'react-native-svg';

import { FOCUS, SCENES } from './coverScenes';

import { testId } from '@/lib/testId';

const W = 390;
const H = 300;

/** The part of the scene a `width`×`height` box shows: CSS `cover`, centered on the focal point. */
function crop(scene: CoverId, width: number, height: number): string {
  const f = FOCUS[scene];
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);
  if (width / height >= W / H) {
    const h = (W * height) / width;
    return `0 ${clamp(f.y - h / 2, H - h)} ${W} ${h}`;
  }
  const w = (H * width) / height;
  return `${clamp(f.x - w / 2, W - w)} 0 ${w} ${H}`;
}

/**
 * A trip's cover scene filling its box, cropped like CSS `cover` around the scene's focal point,
 * so a thin band still shows the tent.
 */
export function Cover({
  scene,
  style,
  testID,
  children,
}: {
  scene: CoverId;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children?: ReactNode;
}) {
  const [box, setBox] = useState<{ width: number; height: number }>();
  const measure = (e: LayoutChangeEvent) => setBox(e.nativeEvent.layout);
  return (
    <View style={[styles.wrap, style]} onLayout={measure} {...testId(testID)}>
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        viewBox={box?.height ? crop(scene, box.width, box.height) : `0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
      >
        {SCENES[scene]}
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', position: 'relative' },
});
