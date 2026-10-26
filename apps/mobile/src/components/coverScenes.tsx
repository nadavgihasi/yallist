import type { CoverId } from '@yallist/domain';
import type { ReactNode } from 'react';
import { Circle, G, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

const illo = colors.illustration;

/** Pennants along the picnic's string, which hangs as y = 40 + 100t(1 − t) over x = 390t. */
const flags = [30, 85, 140, 195, 250, 305, 360].map((x, i) => {
  const t = x / 390;
  const y = 40 + 100 * t * (1 - t);
  const fill = ['#E8590C', '#F7D15C', '#FFFFFF', '#425AF4'][i % 4];
  return <Path key={x} d={`M${x - 11} ${y} L${x + 11} ${y} L${x} ${y + 20} Z`} fill={fill} />;
});

/** The Old City wall's battlements, 28 units apiece. */
const battlements = `M0 196 ${'v-10 h14 v10 h14 '.repeat(14)}V300 H0 Z`;

/**
 * The trip covers: flat layered scenes from SPEC Appendix B (viewBox 390×300), no text, so they
 * read the same in RTL. Camp is the v2 empty-state illustration in the `illustration` tokens;
 * the others keep to a handful of colors each.
 */
export const SCENES: Record<CoverId, ReactNode> = {
  camp: (
    <>
      <Rect width="390" height="300" fill={illo.sky} />
      <Circle cx="268" cy="118" r="48" fill={illo.sun} />
      <Path
        d="M0 168 C70 138 128 152 190 136 C250 121 310 146 390 128 L390 300 L0 300 Z"
        fill={illo.hill}
      />
      <Path
        d="M0 196 C80 170 150 188 220 172 C290 157 340 182 390 170 L390 300 L0 300 Z"
        fill={illo.hillDeep}
      />
      <Rect y="206" width="390" height="94" fill={illo.water} />
      <Path
        d="M232 222 h72 M246 236 h44 M256 250 h24"
        stroke={illo.sun}
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.7"
      />
      <Path
        d="M0 262 C90 248 170 272 260 256 C320 246 360 258 390 252 L390 300 L0 300 Z"
        fill="#1F1752"
      />
      <Path d="M44 264 L84 214 L124 264 Z" fill={illo.tent} />
      <Path d="M84 264 L84 232 L100 264 Z" fill="#E8590C" />
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
  // The Negev: Ramon's flat-topped cliffs, dunes and an acacia.
  desert: (
    <>
      <Rect width="390" height="300" fill="#FFE2B8" />
      <Circle cx="300" cy="86" r="40" fill="#FFF4D6" />
      <Path
        d="M0 172 L56 172 L76 140 L170 140 L190 166 L258 166 L274 150 L340 150 L360 174 L390 174 L390 300 L0 300 Z"
        fill="#E39A62"
      />
      <Path
        d="M0 212 C70 182 140 202 210 192 C280 182 330 206 390 198 L390 300 L0 300 Z"
        fill="#F4C27F"
      />
      <Path
        d="M120 250 L124 214 M124 222 L106 202 M124 222 L144 200"
        stroke="#5B3A29"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <Path d="M82 202 C96 184 156 182 172 200 C150 208 104 208 82 202 Z" fill="#4F6B3A" />
      <Path
        d="M0 252 C90 230 200 264 300 242 C340 234 370 240 390 238 L390 300 L0 300 Z"
        fill="#C97A43"
      />
    </>
  ),
  // The Galilee and the Golan: pines below a snowy Hermon.
  forest: (
    <>
      <Rect width="390" height="300" fill="#CFE8F2" />
      <Circle cx="76" cy="70" r="30" fill="#FFF1B8" />
      <Path d="M140 170 L236 62 L332 170 Z" fill="#8FB3C9" />
      <Path d="M208 94 L236 62 L264 94 L250 88 L236 100 L222 88 Z" fill="#FFFFFF" />
      <Path
        d="M0 176 C80 146 160 168 240 152 C310 138 360 156 390 150 L390 300 L0 300 Z"
        fill="#7DBF8E"
      />
      <Path
        d="M60 236 L88 168 L116 236 Z M104 240 L136 152 L168 240 Z M150 236 L176 178 L202 236 Z M286 232 L312 170 L338 232 Z"
        fill="#2F6B4F"
      />
      <Path
        d="M0 232 C100 216 200 240 300 224 C340 218 370 226 390 222 L390 300 L0 300 Z"
        fill="#1F4D3A"
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
  // A marked trail winding up to the ridge, with its signpost.
  trail: (
    <>
      <Rect width="390" height="300" fill="#FFE7D1" />
      <Circle cx="300" cy="82" r="34" fill="#FFC56B" />
      <Path
        d="M0 176 L70 112 L130 160 L200 96 L290 170 L340 128 L390 168 L390 300 L0 300 Z"
        fill="#C98B6B"
      />
      <Path
        d="M0 206 C80 184 160 200 240 186 C310 174 360 192 390 186 L390 300 L0 300 Z"
        fill="#9C5F4A"
      />
      <Path
        d="M150 300 C160 270 220 262 210 240 C202 224 170 222 186 204 L196 204 C186 220 214 226 224 240 C236 262 196 280 222 300 Z"
        fill="#FFF3E0"
      />
      <Path d="M268 262 L268 196" stroke="#5E3423" strokeWidth="5" strokeLinecap="round" />
      <Path d="M268 202 h34 l8 8 l-8 8 h-34 Z" fill="#F7D15C" />
      <Path d="M268 224 h-30 l-8 8 l8 8 h30 Z" fill="#E8590C" />
    </>
  ),
  // Jerusalem: the Old City wall, its gate and the citadel's tower, among cypresses.
  city: (
    <>
      <Rect width="390" height="300" fill="#FCE1C0" />
      <Circle cx="90" cy="78" r="34" fill="#FFF3D6" />
      <Path
        d="M0 180 C100 160 200 176 300 160 C340 154 370 160 390 158 L390 300 L0 300 Z"
        fill="#E9C595"
      />
      <Rect x="236" y="104" width="44" height="100" fill="#D69F62" />
      <Path d="M236 106 C236 80 280 80 280 106 Z" fill="#B8733A" />
      <Path d="M250 128 v14 M266 128 v14" stroke="#8C5A2B" strokeWidth="4" strokeLinecap="round" />
      <Path d={battlements} fill="#E3B27A" />
      <Path d="M160 250 V222 C160 200 196 200 196 222 V250 Z" fill="#7A4A22" />
      <Path
        d="M56 250 C44 220 50 180 62 160 C74 180 80 220 68 250 Z M332 250 C320 222 326 186 338 168 C350 186 356 222 344 250 Z"
        fill="#3F5E3A"
      />
      <Path d="M0 250 C120 240 250 260 390 246 L390 300 L0 300 Z" fill="#B9814C" />
    </>
  ),
  // A picnic or a festival: the grill in the park, under a string of pennants.
  picnic: (
    <>
      <Rect width="390" height="300" fill="#BDE5CF" />
      <Path d="M0 40 Q195 90 390 40" stroke="#0E1726" strokeWidth="2" fill="none" />
      {flags}
      <Circle cx="110" cy="118" r="30" fill="#FFF1B8" />
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
  // Winter: rain over the hills, and a lit cabin to wait it out in.
  winter: (
    <>
      <Rect width="390" height="300" fill="#AFC0E6" />
      <Path
        d="M40 96 C38 74 68 64 86 76 C96 54 134 54 144 78 C164 72 180 88 172 104 L48 104 C42 104 40 100 40 96 Z"
        fill="#FFFFFF"
      />
      <Path
        d="M232 74 C232 58 254 50 266 60 C274 44 302 44 310 62 C326 58 338 70 332 82 L238 82 C234 82 232 78 232 74 Z"
        fill="#E3E8F7"
      />
      <Path
        d="M70 120 l-8 18 M112 116 l-8 18 M152 124 l-8 18 M262 98 l-8 18 M300 104 l-8 18 M90 152 l-8 18 M134 150 l-8 18 M318 136 l-8 18"
        stroke="#425AF4"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.6"
      />
      <Path
        d="M0 192 C90 166 170 182 250 170 C320 160 360 174 390 170 L390 300 L0 300 Z"
        fill="#7D90C8"
      />
      <Path d="M270 160 h12 v24 h-12 Z" fill="#5E3423" />
      <Rect x="222" y="186" width="64" height="44" fill="#FFF6EC" />
      <Path d="M212 190 L254 158 L296 190 Z" fill="#E8590C" />
      <Rect x="234" y="198" width="16" height="14" fill="#F7D15C" />
      <Rect x="260" y="204" width="14" height="26" fill="#7A3E12" />
      <Path
        d="M0 238 C100 222 200 244 300 230 C340 224 370 230 390 228 L390 300 L0 300 Z"
        fill="#4F5FA0"
      />
      <Path d="M60 270 c0 -7 64 -7 64 0 c0 7 -64 7 -64 0 Z" fill="#AFC0E6" />
    </>
  ),
  // Abroad: a plane over the clouds.
  flight: (
    <>
      <Rect width="390" height="300" fill="#BFE3F9" />
      <Circle cx="80" cy="70" r="34" fill="#FFE7A3" />
      <Path
        d="M40 176 C100 160 140 146 196 128"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="10 12"
      />
      <G transform="rotate(-16 256 118)">
        <Path d="M246 112 L262 112 L246 90 L234 90 Z" fill="#C9D2EE" />
        <Path
          d="M198 112 H302 C316 112 324 116 324 118 C324 120 316 124 302 124 H198 C190 124 190 112 198 112 Z"
          fill="#FFFFFF"
        />
        <Path d="M198 112 L186 92 L198 92 L216 112 Z" fill="#E8590C" />
        <Path d="M240 120 L264 120 L240 150 L226 150 Z" fill="#DDE3F8" />
        <Path
          d="M262 116 h4 M274 116 h4 M286 116 h4 M298 116 h4"
          stroke="#364ED0"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </G>
      <Path
        d="M0 222 C24 196 64 200 78 214 C96 186 146 188 160 214 C180 196 222 200 228 220 C252 200 300 204 308 224 C332 206 378 212 390 228 L390 300 L0 300 Z"
        fill="#E6F2FB"
      />
      <Path
        d="M0 256 C30 236 70 240 86 252 C110 228 160 232 170 252 C196 236 240 240 250 256 C276 238 330 242 340 258 C360 248 380 250 390 256 L390 300 L0 300 Z"
        fill="#FFFFFF"
      />
    </>
  ),
};

/** What a crop keeps in view (viewBox units): the tent, the umbrella, the acacia, the cabin… */
export const FOCUS: Record<CoverId, { x: number; y: number }> = {
  camp: { x: 84, y: 222 },
  beach: { x: 282, y: 200 },
  desert: { x: 126, y: 214 },
  forest: { x: 200, y: 150 },
  zimmer: { x: 185, y: 185 },
  trail: { x: 240, y: 220 },
  city: { x: 220, y: 190 },
  picnic: { x: 198, y: 200 },
  winter: { x: 254, y: 198 },
  flight: { x: 256, y: 128 },
};
