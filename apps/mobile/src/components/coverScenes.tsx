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

/** A hiker walking right with a pack and a stick, feet at (x, y). */
const hiker = (x: number, y: number, body: string, pack: string) => (
  <G key={`${x}-${y}`}>
    <Rect x={x - 11} y={y - 33} width="9" height="15" rx="3" fill={pack} />
    <Path
      d={`M${x} ${y - 29} L${x + 2} ${y - 14}`}
      stroke={body}
      strokeWidth="7"
      strokeLinecap="round"
    />
    <Path
      d={`M${x + 2} ${y - 14} L${x - 5} ${y} M${x + 2} ${y - 14} L${x + 9} ${y}`}
      stroke={body}
      strokeWidth="5"
      strokeLinecap="round"
    />
    <Path
      d={`M${x + 11} ${y - 24} L${x + 15} ${y}`}
      stroke={body}
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <Circle cx={x + 1} cy={y - 37} r="6" fill={body} />
  </G>
);

/** Someone sitting by the fire, seen from behind, seat at (x, y). */
const sitter = (x: number, y: number, fill: string) => (
  <G key={x}>
    <Path
      d={`M${x - 13} ${y} C${x - 13} ${y - 22} ${x - 8} ${y - 28} ${x} ${y - 28} C${x + 8} ${y - 28} ${x + 13} ${y - 22} ${x + 13} ${y} Z`}
      fill={fill}
    />
    <Circle cx={x} cy={y - 36} r="8" fill={fill} />
  </G>
);

/** A clear night's stars over the fire. */
const stars = [
  [30, 40],
  [70, 90],
  [110, 30],
  [150, 70],
  [196, 26],
  [232, 84],
  [350, 40],
  [372, 110],
  [24, 130],
  [190, 120],
].map(([cx, cy]) => <Circle key={`${cx}`} cx={cx} cy={cy} r="2" fill="#FFE39B" />);

/** Red anemones across the spring field. */
const anemones = [
  [30, 262],
  [64, 276],
  [102, 258],
  [140, 282],
  [176, 266],
  [214, 286],
  [252, 262],
  [292, 280],
  [326, 260],
  [362, 276],
].map(([cx, cy]) => (
  <G key={`${cx}`}>
    <Circle cx={cx} cy={cy} r="7" fill="#E5383B" />
    <Circle cx={cx} cy={cy} r="2.5" fill="#0E1726" />
  </G>
));

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
  // Skiing: a lift over the slope, pines and fresh tracks.
  ski: (
    <>
      <Rect width="390" height="300" fill="#CFE3F7" />
      <Circle cx="320" cy="64" r="28" fill="#FFF4D6" />
      <Path d="M0 170 L80 90 L150 150 L230 70 L320 160 L390 120 L390 300 L0 300 Z" fill="#9DB4D8" />
      <Path
        d="M62 108 L80 90 L98 108 L88 104 L80 112 L72 104 Z M208 92 L230 70 L252 92 L240 88 L230 98 L220 88 Z"
        fill="#FFFFFF"
      />
      <Path d="M0 54 L390 112" stroke="#0E1726" strokeWidth="2" />
      <Path
        d="M120 72 v22 M108 94 h22 v10 M276 95 v22 M264 117 h22 v10"
        stroke="#0E1726"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M0 200 C120 180 260 150 390 140 L390 300 L0 300 Z" fill="#F4F8FF" />
      <Path
        d="M360 150 C300 176 340 196 270 206 C220 214 250 236 160 254"
        stroke="#C9D6EE"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M24 232 L46 180 L68 232 Z M60 226 L80 184 L100 226 Z M330 196 L350 150 L370 196 Z"
        fill="#2F6B4F"
      />
      <Path d="M186 232 L240 220" stroke="#0E1726" strokeWidth="4" strokeLinecap="round" />
      <Path
        d="M206 228 L214 212 L204 200 M222 226 L216 212"
        stroke="#364ED0"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path d="M200 202 L208 180 L224 186 L216 208 Z" fill="#E8590C" />
      <Path
        d="M206 192 L190 214 M220 194 L236 214"
        stroke="#0E1726"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <Circle cx="218" cy="172" r="8" fill="#F7D15C" />
      <Path d="M0 256 C120 244 260 266 390 250 L390 300 L0 300 Z" fill="#4F6FA8" />
    </>
  ),
  // Friends walking over the dunes, leaving footprints behind them.
  dunes: (
    <>
      <Rect width="390" height="300" fill="#FFD9A8" />
      <Circle cx="90" cy="80" r="38" fill="#FFF1C9" />
      <Path
        d="M0 170 C60 140 120 150 180 160 C250 172 300 140 390 150 L390 300 L0 300 Z"
        fill="#F2B36F"
      />
      <Path
        d="M0 214 C90 186 170 196 240 204 C300 210 350 190 390 196 L390 300 L0 300 Z"
        fill="#E39A62"
      />
      <Path
        d="M96 208 h6 M118 206 h6 M140 204 h6 M162 202 h6"
        stroke="#C97A43"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {hiker(196, 202, '#5B3A29', '#E8590C')}
      {hiker(230, 204, '#5B3A29', '#425AF4')}
      {hiker(264, 206, '#5B3A29', '#F7D15C')}
      <Path d="M0 250 C100 232 220 262 390 240 L390 300 L0 300 Z" fill="#B9683A" />
    </>
  ),
  // Friends on a path through the woods.
  woods: (
    <>
      <Rect width="390" height="300" fill="#D6EEDB" />
      <Circle cx="300" cy="70" r="30" fill="#FFF1B8" />
      <Path
        d="M0 160 C60 130 120 150 190 136 C260 122 330 150 390 136 L390 300 L0 300 Z"
        fill="#7DBF8E"
      />
      <Path d="M0 190 C100 176 260 196 390 182 L390 300 L0 300 Z" fill="#5FAF84" />
      <Path
        d="M20 236 L52 132 L84 236 Z M76 228 L104 150 L132 228 Z M296 230 L326 128 L356 230 Z M340 236 L366 160 L392 236 Z"
        fill="#2F6B4F"
      />
      <Path
        d="M120 300 C140 270 230 250 210 226 C200 214 250 206 270 196 L282 198 C262 210 216 218 226 230 C250 258 170 276 190 300 Z"
        fill="#F2E2C4"
      />
      {hiker(206, 238, '#1F4D3A', '#E8590C')}
      {hiker(240, 214, '#1F4D3A', '#F7D15C')}
      <Path d="M0 262 C100 250 260 272 390 256 L390 300 L0 300 Z" fill="#1F4D3A" />
    </>
  ),
  // Friends around a campfire under the stars.
  bonfire: (
    <>
      <Rect width="390" height="300" fill="#2A2468" />
      {stars}
      <Circle cx="300" cy="70" r="24" fill="#FFF1C9" />
      <Circle cx="312" cy="62" r="22" fill="#2A2468" />
      <Path
        d="M0 196 C80 170 160 190 240 172 C310 158 360 178 390 172 L390 300 L0 300 Z"
        fill="#3A2F7A"
      />
      <Path d="M302 214 L332 176 L362 214 Z" fill="#FFCF3F" opacity="0.8" />
      <Circle cx="195" cy="226" r="70" fill="#FF9A3C" opacity="0.22" />
      <Path d="M0 244 C120 236 270 252 390 240 L390 300 L0 300 Z" fill="#14102E" />
      <Path
        d="M176 248 L214 236 M176 236 L214 248"
        stroke="#7A3E12"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <Path
        d="M180 240 C176 222 190 214 186 196 C198 206 204 194 202 182 C216 198 214 222 210 240 Z"
        fill="#E8590C"
      />
      <Path d="M188 240 C186 228 196 222 196 210 C206 222 206 232 202 240 Z" fill="#FFCF3F" />
      <Circle cx="216" cy="176" r="2" fill="#FFCF3F" />
      <Circle cx="178" cy="186" r="2" fill="#FFCF3F" />
      {sitter(126, 254, '#0E0A24')}
      {sitter(156, 260, '#0E0A24')}
      {sitter(236, 260, '#0E0A24')}
      {sitter(266, 254, '#0E0A24')}
    </>
  ),
  // Kayaking down the Jordan, between the eucalyptus trees.
  kayak: (
    <>
      <Rect width="390" height="300" fill="#CDEBF5" />
      <Circle cx="80" cy="66" r="30" fill="#FFF1B8" />
      <Path
        d="M0 160 C80 136 160 150 240 140 C310 132 360 146 390 142 L390 300 L0 300 Z"
        fill="#7DBF8E"
      />
      <Path d="M60 180 v-30 M330 176 v-34" stroke="#5E3423" strokeWidth="5" strokeLinecap="round" />
      <Circle cx="60" cy="140" r="22" fill="#3F7D52" />
      <Circle cx="330" cy="130" r="26" fill="#3F7D52" />
      <Rect y="180" width="390" height="76" fill="#2F8FD8" />
      <Path
        d="M40 200 q15 -8 30 0 t30 0 M280 206 q15 -8 30 0 t30 0 M90 240 q15 -8 30 0 t30 0"
        stroke="#FFFFFF"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        opacity="0.7"
      />
      <Path d="M168 202 L250 236" stroke="#0E1726" strokeWidth="4" strokeLinecap="round" />
      <Path d="M160 198 l14 4 l-4 10 Z M244 230 l14 4 l-6 8 Z" fill="#F7D15C" />
      <Path d="M206 222 L210 200" stroke="#364ED0" strokeWidth="9" strokeLinecap="round" />
      <Circle cx="211" cy="190" r="7" fill="#0E1726" />
      <Path d="M150 222 C170 236 250 236 272 222 Z" fill="#E8590C" />
      <Path d="M0 256 C100 244 260 266 390 250 L390 300 L0 300 Z" fill="#2F6B4F" />
    </>
  ),
  // A spring in the Golan: a waterfall between the cliffs into a pool.
  waterfall: (
    <>
      <Rect width="390" height="300" fill="#CFE8F2" />
      <Circle cx="320" cy="56" r="26" fill="#FFF1B8" />
      <Path d="M0 60 L120 80 L150 230 L0 230 Z" fill="#9C6F4F" />
      <Path d="M390 70 L250 84 L232 230 L390 230 Z" fill="#8C5F42" />
      <Path d="M150 80 L240 84 L232 210 L156 210 Z" fill="#A8DBF7" />
      <Path
        d="M168 86 v118 M190 86 v124 M212 86 v120"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.9"
      />
      <Path
        d="M0 60 C40 40 90 50 130 78 L0 78 Z M390 70 C340 52 290 60 246 84 L390 84 Z"
        fill="#3F7D52"
      />
      <Path d="M100 250 C100 212 290 212 290 250 Z" fill="#1E88D6" />
      <Path
        d="M150 222 q12 -6 24 0 t24 0 t24 0"
        stroke="#FFFFFF"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        opacity="0.85"
      />
      <Circle cx="70" cy="230" r="26" fill="#3F7D52" />
      <Circle cx="320" cy="226" r="30" fill="#3F7D52" />
      <Path d="M0 248 C120 236 270 258 390 242 L390 300 L0 300 Z" fill="#3B2E25" />
    </>
  ),
  // Cycling along a country road between the fields.
  bike: (
    <>
      <Rect width="390" height="300" fill="#D7EEF7" />
      <Circle cx="300" cy="70" r="30" fill="#FFE7A3" />
      <Path
        d="M0 170 C80 146 170 162 250 148 C320 136 360 150 390 146 L390 300 L0 300 Z"
        fill="#C8E08A"
      />
      <Path d="M60 180 v-24 M340 172 v-24" stroke="#5E3423" strokeWidth="4" strokeLinecap="round" />
      <Circle cx="60" cy="148" r="16" fill="#5FAF84" />
      <Circle cx="340" cy="140" r="16" fill="#5FAF84" />
      <Path d="M0 214 C120 200 270 222 390 206 L390 236 C270 252 120 230 0 244 Z" fill="#F2E2C4" />
      <Circle cx="168" cy="214" r="16" stroke="#0E1726" strokeWidth="4" fill="none" />
      <Circle cx="228" cy="214" r="16" stroke="#0E1726" strokeWidth="4" fill="none" />
      <Path
        d="M168 214 L190 214 L214 192 L228 214 M190 214 L182 192 L210 192 M182 192 h-6 M214 192 L212 184 h8"
        stroke="#E8590C"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M184 186 L198 164 L214 182 M190 214 L192 198 L184 186"
        stroke="#364ED0"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx="202" cy="154" r="8" fill="#0E1726" />
      <Path d="M0 250 C120 238 270 262 390 244 L390 300 L0 300 Z" fill="#4F7A3A" />
    </>
  ),
  // Spring in bloom: anemones over the green hills.
  spring: (
    <>
      <Rect width="390" height="300" fill="#DCEFF7" />
      <Circle cx="96" cy="72" r="30" fill="#FFF1B8" />
      <Path
        d="M230 80 C230 64 252 56 264 66 C272 50 300 50 308 68 C324 64 336 76 330 88 L236 88 C232 88 230 84 230 80 Z"
        fill="#FFFFFF"
      />
      <Path
        d="M0 176 C80 146 160 166 240 150 C310 136 360 154 390 148 L390 300 L0 300 Z"
        fill="#8CCB7E"
      />
      <Path
        d="M0 214 C100 194 200 214 290 198 C340 190 370 198 390 196 L390 300 L0 300 Z"
        fill="#5FAF64"
      />
      <Path
        d="M120 214 l4 -10 M180 220 l-4 -10 M300 206 l4 -10 M60 222 l-4 -10"
        stroke="#3F7D3A"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <Circle cx="124" cy="202" r="6" fill="#E5383B" />
      <Circle cx="176" cy="208" r="6" fill="#E5383B" />
      <Circle cx="304" cy="194" r="6" fill="#E5383B" />
      <Circle cx="56" cy="210" r="6" fill="#F7D15C" />
      <Path d="M0 244 C120 232 270 254 390 238 L390 300 L0 300 Z" fill="#2F5E2C" />
      {anemones}
    </>
  ),
  // A road trip: a packed car on the desert road at sunset.
  roadtrip: (
    <>
      <Rect width="390" height="300" fill="#FFD6A5" />
      <Circle cx="290" cy="150" r="46" fill="#FFF1C9" />
      <Path
        d="M0 170 L60 128 L120 160 L190 118 L260 168 L330 134 L390 166 L390 300 L0 300 Z"
        fill="#C97A43"
      />
      <Path d="M0 206 C100 196 260 212 390 200 L390 300 L0 300 Z" fill="#E39A62" />
      <Rect y="224" width="390" height="34" fill="#3D3A4E" />
      <Path
        d="M10 241 h30 M70 241 h30 M130 241 h30 M190 241 h30 M250 241 h30 M310 241 h30 M370 241 h30"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <Rect x="150" y="176" width="40" height="12" rx="3" fill="#F7D15C" />
      <Rect x="192" y="178" width="22" height="10" rx="3" fill="#E8590C" />
      <Path d="M150 210 L160 188 L222 188 L236 210 Z" fill="#425AF4" />
      <Path
        d="M164 206 L170 194 L190 194 L190 206 Z M196 206 L196 194 L216 194 L224 206 Z"
        fill="#BFE3F9"
      />
      <Rect x="130" y="206" width="132" height="22" rx="8" fill="#425AF4" />
      <Circle cx="160" cy="228" r="11" fill="#0E1726" />
      <Circle cx="234" cy="228" r="11" fill="#0E1726" />
      <Path d="M0 258 C120 252 270 266 390 256 L390 300 L0 300 Z" fill="#6B3E26" />
    </>
  ),
  // Sailing off Eilat, between the mountains and the sea.
  sail: (
    <>
      <Rect width="390" height="300" fill="#BFE3F9" />
      <Circle cx="300" cy="72" r="32" fill="#FFE7A3" />
      <Path
        d="M0 160 L50 120 L100 150 L160 106 L220 160 Z M240 160 L300 130 L350 150 L390 136 L390 160 Z"
        fill="#C98B6B"
      />
      <Rect y="160" width="390" height="140" fill="#1E88D6" />
      <Path
        d="M30 186 q15 -8 30 0 t30 0 M290 196 q15 -8 30 0 t30 0 M60 230 q15 -8 30 0 t30 0"
        stroke="#FFFFFF"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
        opacity="0.8"
      />
      <Path d="M196 100 L196 214" stroke="#0E1726" strokeWidth="3" strokeLinecap="round" />
      <Path d="M200 104 L254 200 L200 200 Z" fill="#FFFFFF" />
      <Path d="M192 116 L150 200 L192 200 Z" fill="#E8590C" />
      <Path d="M146 214 L256 214 L240 234 L162 234 Z" fill="#FFF6EC" />
      <Path d="M0 252 C120 240 270 262 390 246 L390 300 L0 300 Z" fill="#14558F" />
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
  ski: { x: 212, y: 206 },
  dunes: { x: 230, y: 190 },
  woods: { x: 224, y: 216 },
  bonfire: { x: 196, y: 226 },
  kayak: { x: 210, y: 214 },
  waterfall: { x: 195, y: 180 },
  bike: { x: 198, y: 196 },
  spring: { x: 195, y: 250 },
  roadtrip: { x: 196, y: 210 },
  sail: { x: 200, y: 180 },
};
