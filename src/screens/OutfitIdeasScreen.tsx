import React, { useMemo, useState } from "react";
import { View, Text, FlatList, Image, Pressable, StyleSheet } from "react-native";
import { recommend } from "../services/recommender";
import { useCloset } from "../store/closet";
import { OutfitSuggestion } from "../types";
import { useTheme } from "../context/ThemeContext";

export default function OutfitIdeasScreen() {
  const theme = useTheme();
  const { items } = useCloset();
  const [context, setContext] = useState<"date-night" | "casual" | "formal" | "work" | "party">("date-night");

  const ideas: OutfitSuggestion[] = useMemo(() => recommend(items, context, 5), [items, context]);

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Top picks for {context.replace("-", " ")}</Text>

      <View style={styles.chipContainer}>
        {["date-night", "casual", "formal", "work", "party"].map((c) => (
          <Pressable 
            key={c} 
            onPress={() => setContext(c as any)} 
            style={[styles.chip, context === c && styles.chipActive]}
          >
            <Text style={[styles.chipText, context === c && styles.chipTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      {ideas.length === 0 ? (
        <Text style={styles.emptyText}>Not enough items in your closet for this context yet.</Text>
      ) : (
        <FlatList
          data={ideas}
          keyExtractor={(o) => o.id}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => <OutfitCard suggestion={item} theme={theme} />}
        />
      )}
    </View>
  );
}

function OutfitCard({ suggestion, theme }: { suggestion: OutfitSuggestion; theme: any }) {
  const styles = createStyles(theme);
  
  return (
    <View style={styles.card}>
      <View style={styles.cardImages}>
        {suggestion.items.map((it) => (
          <Image key={it.id} source={{ uri: it.uri }} style={styles.cardImage} />
        ))}
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardScore}>Score: {suggestion.score.toFixed(2)}</Text>
        <Text style={styles.cardContext}>Context: {suggestion.context}</Text>
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography['2xl'],
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  chipActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  chipText: {
    fontWeight: theme.typography.medium,
    color: theme.colors.textSecondary,
  },
  chipTextActive: {
    color: theme.colors.white,
    fontWeight: theme.typography.bold,
  },
  emptyText: {
    color: theme.colors.textTertiary,
    fontSize: theme.typography.base,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: theme.colors.backgroundSecondary,
  },
  cardImages: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  cardImage: {
    width: 70,
    height: 70,
    borderRadius: theme.borderRadius.md,
  },
  cardContent: {
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  cardScore: {
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
  },
  cardContext: {
    color: theme.colors.textSecondary,
  },
});