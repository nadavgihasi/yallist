import { Platform, type TextStyle } from 'react-native';

/**
 * Design system v3 tokens (docs/design/DESIGN.md): warm paper, night ink, sunset violet for what
 * you tap, and orange for what's done.
 * The page background is `ground` and cards are `card`, so "surface" never has two meanings.
 */
export const colors = {
  /** Page background behind cards: warm paper. */
  ground: '#F6F2EA',
  /** Cards and sheets, always on `ground`, outlined with `hairline`. */
  card: '#FFFFFF',
  /** Night ink: headings and body text. */
  ink: '#1A1833',
  inkMuted: '#5C5A6E',
  /** Sunset violet: everything you can tap (solid buttons, selected chips and tabs, links). */
  primary: '#5B3DE0',
  onPrimary: '#FFFFFF',
  /** Tonal buttons, step circles, selected tiles: pale violet. */
  primaryTint: '#ECE7FF',
  /** Violet text and icons on `primaryTint` and `card`. */
  primaryStrong: '#4528C4',
  /** Yallist orange: the logo, done checks and progress. Graphics only; never buttons. */
  brand: '#FF5A1F',
  /** Orange text on `card` and `ground` (e.g. "אצלך", errors). */
  brandStrong: '#B8370B',
  /** Empty-state and cover illustrations only. */
  illustration: {
    sky: '#F4BA7E',
    sun: '#FAE4A4',
    hill: '#A87EC1',
    hillDeep: '#7457AF',
    water: '#364ED0',
    tent: '#F7D15C',
  },
  /** Placeholders. */
  inkFaint: '#8E8B9C',
  /** Tracks: the switch when off, progress, the sheet grabber. */
  line: '#DDD5C7',
  /** The 1px outline of a card on `ground`. */
  hairline: '#E7E0D3',
  scrim: 'rgba(26,24,51,0.45)',
} as const;

/**
 * One hue per category card, in order: its dot and its items' icons. Each is at least 4.3:1 on
 * `card`, so an icon in it reads as clearly as `inkMuted`.
 */
export const accents = ['#5B3DE0', '#0A7C76', '#D9480F', '#C2387A', '#A86A0A', '#2F6FD0'] as const;

/** The accent for the category card at `index`, cycling. */
const accentAt = (index: number) => accents[index % accents.length]!;

/** A category's accent: the one picked for it (`Category.color`), else that of its `index`. */
export const categoryAccent = (color: number | undefined, index: number) =>
  accentAt(color ?? index);

/** Rubik at 400, 700 and 800 (`@expo-google-fonts/rubik`). */
export const fonts = {
  regular: 'Rubik_400Regular',
  bold: 'Rubik_700Bold',
  extraBold: 'Rubik_800ExtraBold',
} as const;

/**
 * Text styles. No `fontWeight`: each weight is its own font family, and a weight on top of it makes
 * web synthesize bold and Android fall back to the system font.
 */
export const type = {
  pageTitle: { fontFamily: fonts.extraBold, fontSize: 34, lineHeight: 40, letterSpacing: -0.34 },
  sectionTitle: { fontFamily: fonts.extraBold, fontSize: 24, lineHeight: 30 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  itemTitle: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  /** The small bold heading of a group of rows ("בישול ועל האש"). */
  label: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18, letterSpacing: 0.2 },
  stepNumber: { fontFamily: fonts.extraBold, fontSize: 19, lineHeight: 24 },
  buttonLg: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 24 },
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
  card: 20,
  input: 14,
  pill: 999,
  /** The icon tile: 22.5% of its size. */
  iconRatio: 0.225,
} as const;

export const size = {
  step: 40,
  /** Kept until every avatar uses `avatarSize`. */
  avatar: 44,
  buttonSm: 44,
  buttonLg: 56,
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

/** Only what floats has a shadow: the floating button and the toast. Cards stay flat. */
export const shadow = {
  float: { boxShadow: '0 8px 24px rgba(69,40,196,0.28)' },
} as const;

/** The card: white on `ground`, outlined with a hairline. Spread into any view that is one. */
export const surface = {
  borderRadius: radius.card,
  borderWidth: 1,
  borderColor: colors.hairline,
  backgroundColor: colors.card,
} as const;
