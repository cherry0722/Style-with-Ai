import React, { useMemo } from "react";
import { SafeAreaView, ScrollView, View, Text, StyleSheet, Image } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { useCurrentOutfitStore } from "../store/useCurrentOutfitStore";
import type { OutfitItemDetail } from "../services/recommender";

export default function AvatarScreen() {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { currentOutfit } = useCurrentOutfitStore();

  console.log("[Avatar] currentOutfit =", currentOutfit);

  const orderedItems: OutfitItemDetail[] = useMemo(() => {
    if (!currentOutfit?.items_detail) return [];
    const order = ["top", "bottom", "shoes"];
    return [...currentOutfit.items_detail].sort((a, b) => {
      const aIndex = a.category ? order.indexOf(a.category) : -1;
      const bIndex = b.category ? order.indexOf(b.category) : -1;
      const safeA = aIndex === -1 ? order.length : aIndex;
      const safeB = bIndex === -1 ? order.length : bIndex;
      return safeA - safeB;
    });
  }, [currentOutfit]);

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
            {!currentOutfit || orderedItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No outfit selected yet</Text>
                <Text style={styles.emptySubtitle}>
                  Ask MYRA for a recommendation on the Home tab, then come back
                  here to see it on your avatar.
                </Text>
              </View>
            ) : (
              <View style={styles.outfitStack}>
                {orderedItems.map((item) => (
                  <View key={item.id} style={styles.outfitItem}>
                    {item.imageUrl ? (
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={styles.outfitImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.outfitImageFallback}>
                        <Text style={styles.outfitImageFallbackText}>
                          No image
                        </Text>
                      </View>
                    )}
                    <Text style={styles.outfitItemLabel}>
                      {item.category ?? "Item"}
                      {item.color ? ` · ${item.color}` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {currentOutfit?.why && (
            <Text style={styles.cardDescription}>{currentOutfit.why}</Text>
          )}

          {currentOutfit?.context?.weather && (
            <Text style={styles.contextText}>
              Weather: {currentOutfit.context.weather.summary ?? "—"},{" "}
              {currentOutfit.context.weather.tempF != null
                ? `${currentOutfit.context.weather.tempF}°F`
                : "—"}
              {currentOutfit.context.weather.precipChance != null
                ? ` · ${currentOutfit.context.weather.precipChance}% chance of rain`
                : ""}
            </Text>
          )}
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
    emptyState: {
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    emptyTitle: {
      fontSize: theme.typography.lg,
      fontWeight: theme.typography.bold as any,
      color: theme.colors.textPrimary,
      textAlign: "center",
    },
    emptySubtitle: {
      fontSize: theme.typography.sm,
      color: theme.colors.textSecondary,
      textAlign: "center",
    },
    outfitStack: {
      flex: 1,
      flexDirection: "column",
      justifyContent: "center",
      gap: theme.spacing.md,
    },
    outfitItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    outfitImage: {
      width: 72,
      height: 72,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.backgroundSecondary,
    },
    outfitImageFallback: {
      width: 72,
      height: 72,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.backgroundSecondary,
    },
    outfitImageFallbackText: {
      fontSize: theme.typography.xs,
      color: theme.colors.textTertiary,
    },
    outfitItemLabel: {
      flex: 1,
      fontSize: theme.typography.sm,
      color: theme.colors.textPrimary,
      textTransform: "capitalize",
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
    contextText: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sm,
    },
    paragraph: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.base,
      lineHeight: 22,
    },
  });
}

