import type { TextStyle } from 'react-native';

export const colors = {
  ink: '#0E1726',
  inkSecondary: '#4B5565',
  inkTertiary: '#9AA3B2',
  ground: '#F4F5F8',
  surface: '#FFFFFF',
  divider: '#EEF0F4',
  borderChip: '#E4E7EE',
  borderPill: '#D9DDE6',
  borderCheckbox: '#C5CCD8',
  accent: '#3B5BFD',
  accentTint: '#3B5BFD1F',
  missing: '#C2410C',
  missingTint: '#FFE9DE',
  missingPeg: '#FFE1D2',
  success: '#1E7A4C',
  successTint: '#E3F4EA',
  white: '#FFFFFF',
  scrim: 'rgba(14,23,38,0.38)',
  glass: 'rgba(255,255,255,0.72)',
  glassFallback: 'rgba(255,255,255,0.92)',
  darkGlass: 'rgba(14,23,38,0.35)',
} as const;

export const avatarPalette = [
  '#FFD9C2',
  '#D8F0E0',
  '#F1DDF7',
  '#FFF0B3',
  '#D3F1F4',
  '#FFDDE4',
  '#E3E0FF',
] as const;

export const fonts = {
  display: 'Fredoka_600SemiBold',
  displayBold: 'Fredoka_700Bold',
  regular: 'Rubik_400Regular',
  medium: 'Rubik_500Medium',
  semibold: 'Rubik_600SemiBold',
} as const;

export const type = {
  screenTitle: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26 },
  bigNumber: { fontFamily: fonts.displayBold, fontSize: 56, lineHeight: 60 },
  itemName: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 20 },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  tab: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14 },
} satisfies Record<string, TextStyle>;

export const radius = {
  card: 28,
  group: 24,
  sheet: 34,
  input: 18,
  pill: 999,
} as const;

export const space = {
  screen: 16,
  touch: 44,
} as const;
