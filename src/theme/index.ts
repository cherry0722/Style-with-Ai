export const colors = {
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
  champagne: '#F7E7CE', // Champagne gold
  sageGreen: '#A8B5A0', // Sage green
  softLavender: '#C8B8D8', // Soft lavender
  nudeBeige: '#E8D5C4', // Nude beige
  
  // Neutral colors - Soft fashion tones
  white: '#FFFFFF',
  black: '#2C2C2C', // Dark charcoal
  gray50: '#FEFCFB', // Off-white with warm tint
  gray100: '#F8F6F4', // Soft cream
  gray200: '#F0EDEA', // Light beige
  gray300: '#E5E1DD', // Soft grey
  gray400: '#B8B3AE', // Muted grey
  gray500: '#8A857F', // Medium grey
  gray600: '#5C5751', // Dark grey
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
  textInverse: '#FFFFFF',
  
  // Border colors - Soft fashion borders
  border: '#E5E1DD', // Soft grey
  borderLight: '#F0EDEA', // Light beige
  borderDark: '#B8B3AE', // Muted grey
  
  // Overlay colors
  overlay: 'rgba(44, 44, 44, 0.3)', // Soft charcoal overlay
  overlayLight: 'rgba(44, 44, 44, 0.1)',
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
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
} as const;

export const typography = {
  // Font sizes
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
  
  // Font weights
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
  
  // Line heights
  tight: 1.25,
  lineHeight: 1.5,
  relaxed: 1.75,
} as const;

export const shadows = {
  sm: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export const darkColors = {
  // Primary brand colors - Fashion dark mode
  primary: '#FFFFFF', // White text on dark
  primaryLight: '#F0F0F0',
  primaryDark: '#E0E0E0',

  // Accent colors - Muted teal for dark mode
  accent: '#8FA8A8', // Lighter muted teal
  accentLight: '#A8B8B8',
  accentDark: '#6B8E8E',

  // Fashion palette colors - Dark mode variants
  dustyRose: '#E8B8B8', // Lighter dusty rose
  champagne: '#F9E7D4', // Lighter champagne
  sageGreen: '#B8C5B0', // Lighter sage
  softLavender: '#D8C8E8', // Lighter lavender
  nudeBeige: '#F0D5C4', // Lighter nude

  // Neutral colors - Fashion dark theme
  white: '#FFFFFF',
  black: '#1A1A1A', // Soft black
  gray50: '#1A1A1A', // Soft black
  gray100: '#2A2A2A', // Dark grey
  gray200: '#3A3A3A', // Medium dark grey
  gray300: '#4A4A4A', // Medium grey
  gray400: '#5A5A5A', // Light grey
  gray500: '#6A6A6A', // Lighter grey
  gray600: '#7A7A7A', // Light grey
  gray700: '#8A8A8A', // Very light grey
  gray800: '#9A9A9A', // Almost white
  gray900: '#AAAAAA', // Light grey

  // Semantic colors - Fashion dark tones
  success: '#A8B8B8', // Lighter muted teal
  warning: '#E8B8B8', // Lighter dusty rose
  error: '#D8A8A8', // Lighter soft red
  info: '#B8C5B0', // Lighter sage

  // Background colors - Fashion dark
  background: '#1A1A1A', // Soft black
  backgroundSecondary: '#2A2A2A', // Dark grey
  backgroundTertiary: '#3A3A3A', // Medium dark grey

  // Text colors - Fashion dark mode
  textPrimary: '#FFFFFF', // White
  textSecondary: '#CCCCCC', // Light grey
  textTertiary: '#999999', // Medium grey
  textInverse: '#1A1A1A', // Soft black

  // Border colors - Fashion dark borders
  border: '#3A3A3A', // Medium dark grey
  borderLight: '#4A4A4A', // Medium grey
  borderDark: '#2A2A2A', // Dark grey

  // Overlay colors
  overlay: 'rgba(26, 26, 26, 0.8)', // Soft black overlay
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
