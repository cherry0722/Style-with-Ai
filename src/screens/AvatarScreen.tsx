import React, { useMemo } from "react";
import { SafeAreaView, ScrollView, View, Text, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext";

export default function AvatarScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Myra Avatar</Text>
          <Text style={styles.subtitle}>
            See your outfits on a virtual you (coming soon)
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.placeholderText}>
              Avatar preview will appear here
            </Text>
          </View>
          <Text style={styles.cardDescription}>
            Soon you'll be able to preview recommended looks on a simple 2D
            avatar that reflects your measurements and vibe. Think of this as
            your personal runway before stepping out.
          </Text>
        </View>

        <Text style={styles.paragraph}>
          This space will evolve into a playful dressing room where you can mix
          and match AI-styled outfits, visualize fits for upcoming events, and
          share snapshots with friends for feedback.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing['2xl'],
      paddingBottom: theme.spacing['3xl'],
      gap: theme.spacing['2xl'],
    },
    header: {
      gap: theme.spacing.sm,
    },
    title: {
      fontSize: theme.typography['3xl'],
      fontWeight: theme.typography.extrabold as any,
      color: theme.colors.textPrimary,
    },
    subtitle: {
      fontSize: theme.typography.lg,
      color: theme.colors.textSecondary,
      lineHeight: 24,
    },
    card: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius['2xl'],
      padding: theme.spacing.xl,
      gap: theme.spacing.lg,
      ...theme.shadows.md,
      borderWidth: 1,
      borderColor: theme.colors.borderLight,
    },
    avatarPlaceholder: {
      height: 260,
      borderRadius: theme.borderRadius['3xl'],
      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: theme.colors.gray300,
      backgroundColor: theme.colors.gray100,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: theme.spacing.lg,
    },
    placeholderText: {
      color: theme.colors.textTertiary,
      fontSize: theme.typography.base,
      textAlign: "center",
    },
    cardDescription: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.base,
      lineHeight: 22,
    },
    paragraph: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.base,
      lineHeight: 22,
    },
  });
}

