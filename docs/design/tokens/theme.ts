export const colors = {
  surface: '#F4F5F8',
  card: '#FFFFFF',
  ink: '#101725',
  inkMuted: '#4D5564',
  primary: '#425AF4',
  onPrimary: '#FFFFFF',
  primaryTint: '#E8EBFE',
  primaryStrong: '#3D53E8',
  brand: '#FF5A1F',
  brandStrong: '#C93F0E',
  illustration: {
    sky: '#F4BA7E',
    sun: '#FAE4A4',
    hill: '#A87EC1',
    hillDeep: '#7457AF',
    water: '#364ED0',
    tent: '#F7D15C',
  },
} as const;

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
  card: 24,
  pill: 999,
  iconRatio: 0.225,
} as const;

export const size = {
  step: 40,
  avatar: 44,
  buttonSm: 44,
  buttonLg: 60,
  ring: { hero: 72, card: 56, status: 28 },
  spot: { width: 160, height: 120 },
} as const;

export const avatarSize = { xs: 24, sm: 28, md: 32, lg: 44, xl: 56, xxl: 96 } as const;

export const progress = { fill: colors.brand, track: '#D5D9E2' } as const;

export const motion = {
  fast: 150,
  base: 250,
  slow: 400,
  celebrate: 1200,
  easing: { out: [0.2, 0, 0, 1] },
} as const;

export const isRTL = true;

export const fontFamily = {
  regular: 'Rubik_400Regular',
  bold: 'Rubik_700Bold',
  extraBold: 'Rubik_800ExtraBold',
} as const;

export const typography = {
  pageTitle: { fontFamily: fontFamily.extraBold, fontWeight: '800', fontSize: 34, lineHeight: 40, letterSpacing: -0.34 },
  sectionTitle: { fontFamily: fontFamily.extraBold, fontWeight: '800', fontSize: 24, lineHeight: 30 },
  body: { fontFamily: fontFamily.regular, fontWeight: '400', fontSize: 16, lineHeight: 24 },
  itemTitle: { fontFamily: fontFamily.bold, fontWeight: '700', fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: fontFamily.regular, fontWeight: '400', fontSize: 14, lineHeight: 20 },
  stepNumber: { fontFamily: fontFamily.extraBold, fontWeight: '800', fontSize: 18, lineHeight: 24 },
  buttonLg: { fontFamily: fontFamily.extraBold, fontWeight: '800', fontSize: 18, lineHeight: 24 },
  buttonSm: { fontFamily: fontFamily.bold, fontWeight: '700', fontSize: 15, lineHeight: 20 },
  stat: { fontFamily: fontFamily.extraBold, fontWeight: '800', fontSize: 28, lineHeight: 32, fontVariant: ['tabular-nums'] },
} as const;

export const shadow = {
  float: {
    shadowColor: '#101725',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  floatCss: '0 10px 24px rgba(16, 23, 37, 0.18)',
} as const;

export const theme = {
  colors,
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
