/**
 * Reusable placeholder for tabs/screens not yet in v1 (e.g. Home, Avatar).
 * No API calls. Safe for crash-proof tabs.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function ComingSoonScreen() {
  const theme = useTheme();
  const styles = createStyles(theme);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Coming Soon</Text>
      <Text style={styles.description}>This feature will be part of v2.</Text>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
      backgroundColor: theme.colors.background,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      marginBottom: 8,
    },
    description: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });
}
