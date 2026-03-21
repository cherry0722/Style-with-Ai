import React, { createContext, useContext, ReactNode } from 'react';
import { useSettings } from '../store/settings';
import { theme, darkTheme } from '../theme';

interface ThemeContextType {
  isDark: boolean;
  colors: any;
  spacing: typeof theme.spacing;
  borderRadius: typeof theme.borderRadius;
  typography: typeof theme.typography;
  shadows: typeof theme.shadows;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const currentTheme = settings.darkMode ? darkTheme : theme;

  return (
    <ThemeContext.Provider
      value={{
        isDark: settings.darkMode,
        colors: currentTheme.colors,
        spacing: currentTheme.spacing,
        borderRadius: currentTheme.borderRadius,
        typography: currentTheme.typography,
        shadows: currentTheme.shadows,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
