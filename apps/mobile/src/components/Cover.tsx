import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type Scene = 'camp' | 'grill' | 'zimmer' | 'beach' | 'blank';

/** Flat layered scenes from SPEC Appendix B (viewBox 390×300), cropped like CSS `cover`. */
const SCENES: Record<Scene, ReactNode> = {
  camp: (
    <>
      <Rect width="390" height="300" fill="#FFB774" />
      <Circle cx="268" cy="118" r="48" fill="#FFE39B" />
      <Path
        d="M0 168 C70 138 128 152 190 136 C250 121 310 146 390 128 L390 300 L0 300 Z"
        fill="#B07CC6"
      />
      <Path
        d="M0 196 C80 170 150 188 220 172 C290 157 340 182 390 170 L390 300 L0 300 Z"
        fill="#7A55B5"
      />
      <Rect y="206" width="390" height="94" fill="#2F4FD8" />
      <Path
        d="M232 222 h72 M246 236 h44 M256 250 h24"
        stroke="#FFE39B"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.7"
      />
      <Path
        d="M0 262 C90 248 170 272 260 256 C320 246 360 258 390 252 L390 300 L0 300 Z"
        fill="#1F1752"
      />
      <Path d="M44 264 L84 214 L124 264 Z" fill="#FFCF3F" />
      <Path d="M84 264 L84 232 L100 264 Z" fill="#E8590C" />
    </>
  ),
  grill: (
    <>
      <Rect width="390" height="300" fill="#BDE5CF" />
      <Circle cx="110" cy="96" r="38" fill="#FFF1B8" />
      <Path
        d="M0 190 C80 160 160 180 240 160 C300 146 350 168 390 158 L390 300 L0 300 Z"
        fill="#5FAF84"
      />
      <Path
        d="M40 232 L70 150 L100 232 Z M250 226 L285 132 L320 226 Z M312 234 L340 166 L368 234 Z"
        fill="#1F6B4A"
      />
      <Path
        d="M0 236 C100 220 200 244 300 228 C340 222 370 230 390 226 L390 300 L0 300 Z"
        fill="#123F2C"
      />
      <Path d="M168 212 h60 l-8 16 h-44 z" fill="#0E1726" />
      <Path
        d="M184 228 l-6 18 M212 228 l6 18"
        stroke="#0E1726"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <Path
        d="M188 200 c-8 -12 8 -18 0 -30 M208 196 c-8 -12 8 -18 0 -30"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
    </>
  ),
  zimmer: (
    <>
      <Rect width="390" height="300" fill="#FFCDB2" />
      <Circle cx="300" cy="90" r="34" fill="#FFF0C2" />
      <Path
        d="M0 170 C90 140 170 160 250 140 C320 124 360 140 390 134 L390 300 L0 300 Z"
        fill="#D9936A"
      />
      <Path
        d="M0 214 C100 190 190 210 280 192 C330 182 370 192 390 188 L390 300 L0 300 Z"
        fill="#A8613F"
      />
      <Path d="M150 216 L150 178 L185 152 L220 178 L220 216 Z" fill="#FFF6EC" />
      <Path d="M140 182 L185 146 L230 182 L222 186 L185 157 L148 186 Z" fill="#E8590C" />
      <Rect x="176" y="192" width="18" height="24" fill="#7A3E12" />
      <Path
        d="M100 218 C96 198 98 178 104 164 C110 178 112 198 108 218 Z M262 212 C258 192 260 174 266 160 C272 174 274 192 270 212 Z"
        fill="#3F5E3A"
      />
      <Path d="M0 246 C120 232 230 254 390 236 L390 300 L0 300 Z" fill="#5E3423" />
    </>
  ),
  beach: (
    <>
      <Rect width="390" height="300" fill="#A8DBF7" />
      <Circle cx="90" cy="88" r="40" fill="#FFE39B" />
      <Rect y="160" width="390" height="70" fill="#1E88D6" />
      <Path
        d="M20 180 q15 -8 30 0 t30 0 M220 194 q15 -8 30 0 t30 0 M120 210 q15 -8 30 0 t30 0"
        stroke="#FFFFFF"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        opacity="0.85"
      />
      <Path d="M0 222 C100 210 220 232 390 214 L390 300 L0 300 Z" fill="#F2C879" />
      <Path d="M270 262 L282 194" stroke="#0E1726" strokeWidth="4" strokeLinecap="round" />
      <Path d="M232 196 C246 158 318 158 332 196 Z" fill="#E8590C" />
      <Path d="M266 196 C270 166 294 166 298 196 Z" fill="#FFF6EC" />
    </>
  ),
  blank: (
    <>
      <Rect width="390" height="300" fill="#DDE3F8" />
      <Rect x="110" y="70" width="170" height="26" rx="13" fill="#FFFFFF" />
      <Rect x="110" y="110" width="130" height="26" rx="13" fill="#FFFFFF" />
      <Rect x="110" y="150" width="150" height="26" rx="13" fill="#FFFFFF" opacity="0.6" />
    </>
  ),
};

/** Tile background color per scene (template picker). */
export const SCENE_TINT: Record<Scene, string> = {
  camp: '#FFB774',
  grill: '#BDE5CF',
  zimmer: '#FFCDB2',
  beach: '#A8DBF7',
  blank: '#DDE3F8',
};

export function Cover({
  scene,
  style,
  children,
}: {
  scene: Scene;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  return (
    <View style={[styles.wrap, style]}>
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        viewBox="0 0 390 300"
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
