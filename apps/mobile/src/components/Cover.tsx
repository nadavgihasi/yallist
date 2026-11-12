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

import { crop, SCENE_H, SCENE_W } from './coverCrop';
import { FOCUS, SCENES } from './coverScenes';
import { STATE_SPOTS, type SpotId } from './stateSpots';

import { testId } from '@/lib/testId';
import { radius, size } from '@/theme';

/**
 * A trip's cover scene filling its box, cropped like CSS `cover` around the scene's focal point
 * (two thirds down a thin band), so a thin band still shows the tent and the horizon above it.
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
        viewBox={
          box?.height ? crop(FOCUS[scene], box.width, box.height) : `0 0 ${SCENE_W} ${SCENE_H}`
        }
        preserveAspectRatio="xMidYMid slice"
      >
        {SCENES[scene]}
      </Svg>
      {children}
    </View>
  );
}

/** An `EmptyState` picture (`size.spot`): a state spot, or a 4:3 crop of a cover scene. */
export function Spot({ id }: { id: SpotId | CoverId }) {
  // Decorative: the title next to it says it all.
  return id in STATE_SPOTS ? (
    <View style={[styles.wrap, styles.spot]} aria-hidden>
      <Svg width="100%" height="100%" viewBox="0 0 160 120">
        {STATE_SPOTS[id as SpotId]}
      </Svg>
    </View>
  ) : (
    <View aria-hidden>
      <Cover scene={id as CoverId} style={styles.spot} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', position: 'relative' },
  spot: { ...size.spot, borderRadius: radius.card - 4 },
});
