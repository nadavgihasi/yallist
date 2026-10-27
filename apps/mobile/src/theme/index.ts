import { Platform, type TextStyle } from 'react-native';

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
  /** Countdowns and stats; tabular digits so counts don't shift as they change (Rubik has `tnum`). */
  stat: {
    fontFamily: fonts.extraBold,
    fontSize: 28,
    lineHeight: 32,
    fontVariant: ['tabular-nums'],
  },
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

export const layout = {
  /** The single content column on web and tablets. */
  contentMax: 448,
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
  /** Kept until every avatar uses `avatarSize`. */
  avatar: 44,
  buttonSm: 44,
  buttonLg: 60,
  /** `ProgressRing` on the trip hero and on cards; `status` is the row check (`StatusRing`). */
  ring: { hero: 72, card: 56, status: 28 },
  /** A 4:3 crop of a scene, or a state spot. */
  spot: { width: 160, height: 120 },
} as const;

/** Avatar diameters; `xxl` is the profile picture. */
export const avatarSize = { xs: 24, sm: 28, md: 32, lg: 44, xl: 56, xxl: 96 } as const;

/** Orange progress (rings, bars) on a `line` track, visible at 0%. Graphics only: a count always sits beside it. */
export const progress = { fill: colors.brand, track: colors.line } as const;

/** Durations in ms, and the one easing curve (cubic-bezier control points). */
export const motion = {
  fast: 150,
  base: 250,
  slow: 400,
  celebrate: 1200,
  easing: { out: [0.2, 0, 0, 1] },
} as const;

/**
 * The app is Hebrew-only. Read this, never `I18nManager.isRTL`, which is `false` on
 * react-native-web.
 */
export const isRTL = true;

/** react-native-web resolves start/end styles from the nearest `dir`, not from `<html dir>`. */
export const webDir = (Platform.OS === 'web' ? { dir: isRTL ? 'rtl' : 'ltr' } : {}) as object;

/** Only the floating primary button has a shadow; cards stay flat. */
export const shadow = {
  float: { boxShadow: '0 10px 24px rgba(16,23,37,0.18)' },
} as const;
