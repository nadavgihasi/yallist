import type { TextStyle } from 'react-native';

/**
 * Design system v2 tokens (docs/design/tokens). Names follow the handoff, except the page
 * background: the handoff's `surface` is `ground` here, so `surface` never silently changes
 * meaning from "card" to "page".
 */
export const colors = {
  /** Page background behind cards (handoff `surface`). */
  ground: '#F4F5F8',
  /** Cards and sheets, always on `ground`. */
  card: '#FFFFFF',
  ink: '#101725',
  inkMuted: '#4D5564',
  /** Everything you can tap. */
  primary: '#425AF4',
  onPrimary: '#FFFFFF',
  /** Tonal buttons, step circles, selected chips. */
  primaryTint: '#E8EBFE',
  /** Blue text on `primaryTint` at small sizes. */
  primaryStrong: '#3D53E8',
  /** Yallist orange: the logo, done checks and progress. Graphics only; never buttons. */
  brand: '#FF5A1F',
  /** Orange text on `card` (e.g. "אצלך", errors). */
  brandStrong: '#C93F0E',
  /** Empty-state and cover illustrations only. */
  illustration: {
    sky: '#F4BA7E',
    sun: '#FAE4A4',
    hill: '#A87EC1',
    hillDeep: '#7457AF',
    water: '#364ED0',
    tent: '#F7D15C',
  },
  // App additions the handoff doesn't cover.
  /** Placeholders. */
  inkFaint: '#8B93A1',
  /** Switch track when off. */
  line: '#D5D9E2',
  scrim: 'rgba(16,23,37,0.38)',
} as const;

/** Rubik at 400, 700 and 800 (`@expo-google-fonts/rubik`). */
export const fonts = {
  regular: 'Rubik_400Regular',
  bold: 'Rubik_700Bold',
  extraBold: 'Rubik_800ExtraBold',
} as const;

/**
 * Text styles. Sizes within 2px of what the app already used keep the app's value (handoff
 * task 2). No `fontWeight`: each weight is its own font family, and a weight on top of it makes
 * web synthesize bold and Android fall back to the system font.
 */
export const type = {
  pageTitle: { fontFamily: fonts.extraBold, fontSize: 36, lineHeight: 40, letterSpacing: -0.36 },
  sectionTitle: { fontFamily: fonts.extraBold, fontSize: 26, lineHeight: 32 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  itemTitle: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  stepNumber: { fontFamily: fonts.extraBold, fontSize: 19, lineHeight: 24 },
  buttonLg: { fontFamily: fonts.extraBold, fontSize: 17, lineHeight: 24 },
  buttonSm: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 },
  /** App addition: the money total. */
  bigNumber: { fontFamily: fonts.extraBold, fontSize: 56, lineHeight: 60 },
} satisfies Record<string, TextStyle>;

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  /** Screen side padding. */
  screen: 16,
  /** Minimum touch target. */
  touch: 44,
} as const;

export const radius = {
  card: 24,
  input: 16,
  pill: 999,
  /** The icon tile: 22.5% of its size. */
  iconRatio: 0.225,
} as const;

export const size = {
  step: 40,
  avatar: 44,
  buttonSm: 44,
  buttonLg: 60,
} as const;

/** Only the floating primary button has a shadow; cards stay flat. */
export const shadow = {
  float: { boxShadow: '0 10px 24px rgba(16,23,37,0.18)' },
} as const;
