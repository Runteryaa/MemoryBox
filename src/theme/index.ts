import { useColorScheme } from 'react-native';

import { useSettingsStore } from '@/store/useSettingsStore';
import type { ThemeMode } from '@/types';

export interface AppColors {
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceRaised: string;
  paper: string;
  paperLines: string;
  paperEdge: string;
  ink: string;
  inkSoft: string;
  muted: string;
  faint: string;
  border: string;
  borderStrong: string;
  rose: string;
  roseDeep: string;
  roseSoft: string;
  pink: string;
  amber: string;
  amberSoft: string;
  sage: string;
  sageSoft: string;
  stamp: string;
  stampSoft: string;
  white: string;
  /** The physical paper a polaroid is printed on — white in either theme. */
  photoPaper: string;
  /** Ink printed on that paper, so dark mode never writes light-on-white. */
  photoInk: string;
  photoInkSoft: string;
  shadow: string;
  overlay: string;
  tabBar: string;
  tabBarBorder: string;
  boxBase: string;
  boxBaseDeep: string;
  boxLid: string;
  boxLidDeep: string;
  boxInside: string;
  ribbon: string;
  gold: string;
  goldDeep: string;
  locked: string;
  lockedSoft: string;
  danger: string;
}

export interface AppTheme {
  scheme: 'light' | 'dark';
  colors: AppColors;
  isDark: boolean;
  gradients: {
    screen: [string, string, string];
    warm: [string, string];
    rose: [string, string];
    flame: [string, string, string];
    box: [string, string, string];
    lid: [string, string, string];
  };
}

const lightColors: AppColors = {
  background: '#FDFBF7',
  backgroundAlt: '#F8F0E6',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFDF9',
  paper: '#FFFCF4',
  paperLines: '#EBDFCE',
  paperEdge: '#F1E5D4',
  ink: '#2D241D',
  inkSoft: '#4A3C31',
  muted: '#8A7768',
  faint: '#B8A99B',
  border: '#EDE1D2',
  borderStrong: '#DECDB9',
  rose: '#E11D48',
  roseDeep: '#BE123C',
  roseSoft: '#FFE4E6',
  pink: '#F472B6',
  amber: '#F59E0B',
  amberSoft: '#FEF3C7',
  sage: '#4D7C0F',
  sageSoft: '#ECFCCB',
  stamp: '#64748B',
  stampSoft: '#EEF2F6',
  white: '#FFFFFF',
  photoPaper: '#FFFFFF',
  photoInk: '#2D241D',
  photoInkSoft: '#8A7768',
  shadow: 'rgba(83, 57, 37, 0.18)',
  overlay: 'rgba(41, 29, 20, 0.55)',
  tabBar: 'rgba(255, 252, 246, 0.94)',
  tabBarBorder: 'rgba(222, 205, 185, 0.7)',
  boxBase: '#E8B08C',
  boxBaseDeep: '#C77B55',
  boxLid: '#F7DCC4',
  boxLidDeep: '#E4B48B',
  boxInside: '#8A4B32',
  ribbon: '#D97757',
  gold: '#E9B949',
  goldDeep: '#B47E22',
  locked: '#B8A99B',
  lockedSoft: '#F1E9DE',
  danger: '#C2410C',
};

const darkColors: AppColors = {
  background: '#1C1917',
  backgroundAlt: '#241F1C',
  surface: '#2A2522',
  surfaceRaised: '#332C27',
  paper: '#2C2621',
  paperLines: '#463C34',
  paperEdge: '#3B322B',
  ink: '#F8EFE6',
  inkSoft: '#E8DCCE',
  muted: '#B9A999',
  faint: '#8C7D70',
  border: '#3E3630',
  borderStrong: '#54483E',
  rose: '#FB7185',
  roseDeep: '#F43F5E',
  roseSoft: '#4C1D24',
  pink: '#F9A8D4',
  amber: '#FBBF24',
  amberSoft: '#4A3511',
  sage: '#A3C45C',
  sageSoft: '#2E3A17',
  stamp: '#A8B6C6',
  stampSoft: '#30363D',
  white: '#FFFFFF',
  photoPaper: '#FBF6EE',
  photoInk: '#3B2E25',
  photoInkSoft: '#8A7666',
  shadow: 'rgba(0, 0, 0, 0.4)',
  overlay: 'rgba(10, 8, 6, 0.72)',
  tabBar: 'rgba(36, 31, 28, 0.94)',
  tabBarBorder: 'rgba(84, 72, 62, 0.7)',
  boxBase: '#9C5A42',
  boxBaseDeep: '#6E3B2A',
  boxLid: '#B97B5C',
  boxLidDeep: '#8D563D',
  boxInside: '#3C2118',
  ribbon: '#C96D4F',
  gold: '#F0C75E',
  goldDeep: '#C69633',
  locked: '#77695C',
  lockedSoft: '#332C27',
  danger: '#FB923C',
};

export const lightTheme: AppTheme = {
  scheme: 'light',
  isDark: false,
  colors: lightColors,
  gradients: {
    screen: ['#FDFBF7', '#FBF3E8', '#FDFBF7'],
    warm: ['#FFF7EA', '#FFEAD7'],
    rose: ['#F472B6', '#E11D48'],
    flame: ['#FDE68A', '#F59E0B', '#E11D48'],
    box: ['#F3C6A4', '#D98F69', '#B86A46'],
    lid: ['#FBE8D5', '#F0C7A5', '#DBA37C'],
  },
};

export const darkTheme: AppTheme = {
  scheme: 'dark',
  isDark: true,
  colors: darkColors,
  gradients: {
    screen: ['#1C1917', '#221C18', '#1C1917'],
    warm: ['#2A231E', '#3A2B22'],
    rose: ['#F9A8D4', '#E11D48'],
    flame: ['#FDE68A', '#F59E0B', '#BE123C'],
    box: ['#A9664C', '#7E4531', '#5A2D20'],
    lid: ['#C98D6D', '#A9664C', '#7E4531'],
  },
};

export const fonts = {
  sansLight: 'Quicksand_400Regular',
  sans: 'Quicksand_500Medium',
  sansSemiBold: 'Quicksand_600SemiBold',
  sansBold: 'Quicksand_700Bold',
  hand: 'Caveat_500Medium',
  handBold: 'Caveat_700Bold',
  serif: 'Fraunces_600SemiBold',
  serifRegular: 'Fraunces_400Regular',
};

export const radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 30,
  pill: 999,
};

export const shadows = {
  soft: {
    shadowColor: '#533925',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },
  card: {
    shadowColor: '#533925',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
};

export function resolveTheme(mode: ThemeMode, systemScheme: 'light' | 'dark' | null): AppTheme {
  const scheme = mode === 'system' ? systemScheme ?? 'light' : mode;
  return scheme === 'dark' ? darkTheme : lightTheme;
}

/** Pick dark or light foreground text for a solid background colour. */
export function contrastInk(background: string): string {
  const hex = background.replace('#', '');
  if (hex.length !== 6 || /[^0-9a-f]/i.test(hex)) return '#FFFFFF';
  const channels = [0, 2, 4].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4)
  );
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? '#1C1917' : '#FFFFFF';
}

export function useTheme(): AppTheme {
  const scheme = useColorScheme();
  const mode = useSettingsStore((state) => state.themeMode);
  return resolveTheme(mode, scheme);
}
