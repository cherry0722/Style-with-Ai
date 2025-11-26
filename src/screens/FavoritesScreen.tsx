import React from "react";
import { View, Text, FlatList, Image, StyleSheet } from "react-native";
import { useFavorites } from "../store/favorites";
import { useTheme } from "../context/ThemeContext";

export default function FavoritesScreen() {
  const theme = useTheme();
  const { items } = useFavorites();
  const styles = createStyles(theme);

  if (items.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No favorites yet. Tap the ♥ on an outfit to save it.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(o) => o.id}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardImages}>
              {item.items.map((it) => (
                <Image key={it.id} source={{ uri: it.imageUrl || it.uri }} style={styles.cardImage} />
              ))}
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardScore}>Score: {item.score.toFixed(2)}</Text>
              <Text style={styles.cardContext}>Context: {item.context}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: theme.colors.textTertiary,
    fontSize: theme.typography.base,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    overflow: "hidden",
    backgroundColor: theme.colors.backgroundSecondary,
  },
  cardImages: {
    flexDirection: "row",
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    alignItems: "center",
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

