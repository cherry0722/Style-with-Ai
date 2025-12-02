import React, { useMemo, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Alert } from 'react-native';
import { useCloset } from '../store/closet';
import { toggleFavorite } from '../api/wardrobe';
import ClothingCard from '../components/ClothingCard';
import { Garment } from '../types';
import { useTheme } from '../context/ThemeContext';

export default function FavoritesScreen() {
  const theme = useTheme();
  // Subscribe to items directly (stable reference, no derived arrays in selector)
  const items = useCloset((state) => state.items);
  const updateItem = useCloset((state) => state.updateItem);

  // Derive favorites with useMemo (pure, no side effects)
  const favorites = useMemo(
    () => items.filter((item) => item.isFavorite === true),
    [items]
  );

  // Favorite toggle handler with optimistic update and rollback
  const handleToggleFavorite = useCallback(
    async (id: string, next: boolean) => {
      const prev = items.find((item) => item.id === id);
      if (!prev) return;

      // Optimistic update
      updateItem(id, { isFavorite: next });

      try {
        const res = await toggleFavorite(id, next);
        // Ensure store matches backend response
        updateItem(id, { isFavorite: res.isFavorite });
      } catch (err) {
        console.error('[FavoritesScreen] toggleFavorite error, rolling back', err);
        // Rollback on error
        updateItem(id, { isFavorite: !next });
        Alert.alert('Error', 'Could not update favorite. Please try again.');
      }
    },
    [items, updateItem]
  );

  const styles = createStyles(theme);

  if (favorites.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          No favorite items yet. Tap the ♥ on a piece in your closet to favorite it.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <ClothingCard
            item={item}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
      />
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing.xl,
    },
    emptyText: {
      fontSize: theme.typography.base,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      lineHeight: theme.typography.base * theme.typography.lineHeight,
    },
    list: {
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
  });
