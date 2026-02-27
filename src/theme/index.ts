export const colors = {
<<<<<<< HEAD
  // Primary brand colors - Fashion editorial
  primary: '#2C2C2C', // Dark charcoal instead of pure black
  primaryLight: '#3C3C3C',
  primaryDark: '#1C1C1C',
  
  // Accent colors - Muted teal (fashion editorial)
  accent: '#6B8E8E', // Muted teal
  accentLight: '#8FA8A8',
  accentDark: '#4A6B6B',
  
  // Fashion palette colors
  dustyRose: '#D4A5A5', // Soft dusty rose
  champagne: '#F7E7CE', // Champagne gold color
  sageGreen: '#A8B5A0', // Sage green
  softLavender: '#C8B8D8', // Soft lavender
  nudeBeige: '#E8D5C4', // Nude beige
  
  // Neutral colors - Soft fashion tones
  white: '#FFFFFF',
  black: '#2C2C2C', // Dark charcoal
  gray50: '#FEFCFB', // Off-white with warm tint
  gray100: '#F8F6F4', // Soft cream color
  gray200: '#F0EDEA', // Light beige
  gray300: '#E5E1DD', // Soft grey color
  gray400: '#B8B3AE', // Muted grey
  gray500: '#8A857F', // Medium grey
  gray600: '#5C5751', // Dark grey color
  gray700: '#3E3A35', // Charcoal
  gray800: '#2C2C2C', // Dark charcoal
  gray900: '#1C1C1C', // Almost black
  
  // Semantic colors - Fashion tones
  success: '#8FA8A8', // Muted teal
  warning: '#D4A5A5', // Dusty rose
  error: '#C8A8A8', // Soft red
  info: '#A8B5A0', // Sage green
  
  // Background colors - Soft gradients
  background: '#FEFCFB', // Off-white
  backgroundSecondary: '#F8F6F4', // Soft cream
  backgroundTertiary: '#F0EDEA', // Light beige
  
  // Text colors - Fashion editorial
  textPrimary: '#2C2C2C', // Dark charcoal
  textSecondary: '#8A857F', // Medium grey
  textTertiary: '#B8B3AE', // Muted grey
=======
  // Primary brand colors — warm dark brown
  primary: '#3D3426',
  primaryLight: '#5A4C3A',
  primaryDark: '#2A2318',

  // Accent — warm gold
  accent: '#C4A882',
  accentLight: '#E8D9C5',
  accentDark: '#A8896A',

  // Fashion palette (kept for compatibility)
  dustyRose: '#D4A5A5',
  champagne: '#F7E7CE',
  sageGreen: '#A8B5A0',
  softLavender: '#C8B8D8',
  nudeBeige: '#EDE6D8',

  // Neutrals
  white: '#FFFFFF',
  black: '#3D3426',
  gray50: '#FAF7F2',   // off-white cream
  gray100: '#F5F0E8',  // warm beige (main bg)
  gray200: '#EDE6D8',  // sand / card fill
  gray300: '#E8E0D0',  // border
  gray400: '#B5A894',  // text light
  gray500: '#8C7E6A',  // text muted
  gray600: '#6B5E4E',
  gray700: '#4A3E30',
  gray800: '#3D3426',
  gray900: '#2A2318',

  // Semantic
  success: '#8BA888',
  warning: '#D4A574',   // laundry / warm amber
  error: '#C8706A',
  info: '#A8B5A0',

  // Backgrounds
  background: '#F5F0E8',          // warm beige — main
  backgroundSecondary: '#FAF7F2', // off-white cream
  backgroundTertiary: '#EDE6D8',  // sand / card fill

  // Text
  textPrimary: '#3D3426',
  textSecondary: '#8C7E6A',
  textTertiary: '#B5A894',
>>>>>>> 0178d85 (Updated UI with new layout)
  textInverse: '#FFFFFF',

  // Borders
  border: '#E8E0D0',
  borderLight: '#F0E8DC',
  borderDark: '#D0C4B0',

  // Overlays
  overlay: 'rgba(61, 52, 38, 0.4)',
  overlayLight: 'rgba(61, 52, 38, 0.08)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 22,
  '3xl': 28,
  full: 9999,
} as const;

export const typography = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,

  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,

  tight: 1.25,
  lineHeight: 1.5,
  relaxed: 1.75,
} as const;

export const shadows = {
  sm: {
    shadowColor: 'rgba(61, 52, 38, 0.08)',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: 'rgba(61, 52, 38, 0.08)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  lg: {
    shadowColor: 'rgba(61, 52, 38, 0.10)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
  },
  xl: {
    shadowColor: 'rgba(61, 52, 38, 0.12)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

export const darkColors = {
  primary: '#FFFFFF',
  primaryLight: '#F0F0F0',
  primaryDark: '#E0E0E0',

  accent: '#C4A882',
  accentLight: '#E8D9C5',
  accentDark: '#A8896A',

  dustyRose: '#E8B8B8',
  champagne: '#F9E7D4',
  sageGreen: '#B8C5B0',
  softLavender: '#D8C8E8',
  nudeBeige: '#F0D5C4',

  white: '#FFFFFF',
  black: '#1A1A1A',
  gray50: '#1A1A1A',
  gray100: '#2A2A2A',
  gray200: '#3A3A3A',
  gray300: '#4A4A4A',
  gray400: '#5A5A5A',
  gray500: '#6A6A6A',
  gray600: '#7A7A7A',
  gray700: '#8A8A8A',
  gray800: '#9A9A9A',
  gray900: '#AAAAAA',

  success: '#8BA888',
  warning: '#E8B878',
  error: '#D8A8A8',
  info: '#B8C5B0',

  background: '#1A1A1A',
  backgroundSecondary: '#2A2A2A',
  backgroundTertiary: '#3A3A3A',

  textPrimary: '#FFFFFF',
  textSecondary: '#CCCCCC',
  textTertiary: '#999999',
  textInverse: '#1A1A1A',

  border: '#3A3A3A',
  borderLight: '#4A4A4A',
  borderDark: '#2A2A2A',

  overlay: 'rgba(26, 26, 26, 0.8)',
  overlayLight: 'rgba(26, 26, 26, 0.5)',
} as const;

export const theme = {
  colors,
  spacing,
  borderRadius,
  typography,
  shadows,
} as const;

export const darkTheme = {
  colors: darkColors,
  spacing,
  borderRadius,
  typography,
  shadows,
} as const;

export type Theme = typeof theme;
export type DarkTheme = typeof darkTheme;
