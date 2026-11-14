export const colors = {
  surface: '#F6F2EA',
  card: '#FFFFFF',
  ink: '#1A1833',
  inkMuted: '#5C5A6E',
  primary: '#5B3DE0',
  onPrimary: '#FFFFFF',
  primaryTint: '#ECE7FF',
  primaryStrong: '#4528C4',
  brand: '#FF5A1F',
  brandStrong: '#B8370B',
  illustration: {
    sky: '#F4BA7E',
    sun: '#FAE4A4',
    hill: '#A87EC1',
    hillDeep: '#7457AF',
    water: '#364ED0',
    tent: '#F7D15C',
  },
  line: '#DDD5C7',
  hairline: '#E7E0D3',
} as const;

export const accents = ['#5B3DE0', '#0A7C76', '#D9480F', '#C2387A', '#A86A0A', '#2F6FD0'] as const;

export const space = {
  1: 4,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
} as const;

export const layout = {
  contentMax: 448,
} as const;

export const radius = {
  card: 20,
  pill: 999,
  iconRatio: 0.225,
} as const;

export const size = {
  step: 40,
  avatar: 44,
  buttonSm: 44,
  buttonLg: 56,
  ring: { hero: 72, card: 56, status: 28 },
  spot: { width: 160, height: 120 },
} as const;

export const avatarSize = { xs: 24, sm: 28, md: 32, lg: 44, xl: 56, xxl: 96 } as const;

export const progress = { fill: colors.brand, track: colors.line } as const;

export const motion = {
  fast: 150,
  base: 250,
  slow: 400,
  celebrate: 1200,
  easing: { out: [0.2, 0, 0, 1] },
} as const;

export const isRTL = true;

export const fontFamily = {
  display: 'SuezOne_400Regular',
  regular: 'Rubik_400Regular',
  bold: 'Rubik_700Bold',
  extraBold: 'Rubik_800ExtraBold',
} as const;

export const typography = {
  pageTitle: { fontFamily: fontFamily.display, fontWeight: '400', fontSize: 34, lineHeight: 40 },
  sectionTitle: { fontFamily: fontFamily.display, fontWeight: '400', fontSize: 24, lineHeight: 30 },
  body: { fontFamily: fontFamily.regular, fontWeight: '400', fontSize: 16, lineHeight: 24 },
  itemTitle: { fontFamily: fontFamily.bold, fontWeight: '700', fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: fontFamily.regular, fontWeight: '400', fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fontFamily.bold, fontWeight: '700', fontSize: 13, lineHeight: 18, letterSpacing: 0.2 },
  stepNumber: { fontFamily: fontFamily.extraBold, fontWeight: '800', fontSize: 19, lineHeight: 24 },
  buttonLg: { fontFamily: fontFamily.bold, fontWeight: '700', fontSize: 17, lineHeight: 24 },
  buttonSm: { fontFamily: fontFamily.bold, fontWeight: '700', fontSize: 15, lineHeight: 20 },
  stat: { fontFamily: fontFamily.extraBold, fontWeight: '800', fontSize: 28, lineHeight: 32, fontVariant: ['tabular-nums'] },
} as const;

export const shadow = {
  float: {
    shadowColor: '#4528C4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 8,
  },
  floatCss: '0 8px 24px rgba(69, 40, 196, 0.28)',
} as const;

export const theme = {
  colors,
  accents,
  space,
  layout,
  radius,
  size,
  avatarSize,
  progress,
  motion,
  isRTL,
  fontFamily,
  typography,
  shadow,
} as const;

export type Theme = typeof theme;
