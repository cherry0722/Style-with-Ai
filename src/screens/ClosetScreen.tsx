// NOTE: ClosetScreen requires an authenticated user; logged-out users see a login prompt.
import React, { useEffect, useState, useCallback } from "react";
import { View, FlatList, Text, ActivityIndicator, Alert, SafeAreaView, Pressable } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { Ionicons } from "@expo/vector-icons";
import ClothingCard from "../components/ClothingCard";
import { useCloset } from "../store/closet";
import { useAuth } from "../context/AuthContext";
import { fetchWardrobeItems, toggleFavorite, deleteWardrobeItem, WardrobeItemResponse } from "../api/wardrobe";
import { Garment } from "../types";
import { useTheme } from "../context/ThemeContext";

export default function ClosetScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(false);
  const isFocused = useIsFocused();
  const theme = useTheme();

  const items = useCloset((state) => state.items);
  const setItems = useCloset((state) => state.setItems);
  const remove = useCloset((state) => state.remove);
  const updateItem = useCloset((state) => state.updateItem);

  const loadWardrobe = async () => {
    if (!user) {
      // Clear items when logging out
      setItems([]);
      return;
    }

    try {
      setLoading(true);
      console.log('[ClosetScreen] Fetching wardrobe items from backend...');
      const data: WardrobeItemResponse[] = await fetchWardrobeItems();

      const mapped: Garment[] = data.map((item) => ({
        id: item._id,
        imageUrl: item.imageUrl,
        cleanImageUrl: item.cleanImageUrl,
        category: item.category,
        colors: item.colors ?? [],
        notes: item.notes,
        isFavorite: item.isFavorite ?? false,
        tags: item.tags ?? [],
        metadata: item.metadata,
        // no local uri from backend
      }));

      setItems(mapped);
      console.log('[ClosetScreen] Wardrobe items loaded:', mapped.length);
    } catch (err: any) {
      console.error('[ClosetScreen] Failed to fetch wardrobe:', err);
      Alert.alert(
        'Error',
        err?.message || 'Failed to load your wardrobe. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = useCallback(
    async (id: string, next: boolean) => {
      console.log("[ClosetScreen] Toggling favorite for id=", id, "next=", next);

      // Find previous state for rollback
      const prev = items.find((item) => item.id === id);
      const prevIsFavorite = prev?.isFavorite ?? !next;

      // Optimistic update: update Zustand store first
      updateItem(id, { isFavorite: next });

      try {
        const updated = await toggleFavorite(id, next);
        console.log("[ClosetScreen] toggleFavorite response:", updated);

        // Sync with backend response
        updateItem(id, {
          isFavorite: updated.isFavorite,
        });
      } catch (err: any) {
        // Rollback on error
        updateItem(id, { isFavorite: prevIsFavorite });
        console.error("[ClosetScreen] Failed to toggle favorite:", err);
        Alert.alert("Error", "Could not update favorite. Please try again.");
      }
    },
    [items, updateItem]
  );

  const handleDeleteItem = useCallback(
    (id: string) => {
      if (!user) return; // extra safety

      Alert.alert(
        'Delete item?',
        'This will remove this clothing item from your Myra wardrobe.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteWardrobeItem(id);
                // Update local state to remove it from the list
                remove(id);
                console.log('[ClosetScreen] Item deleted successfully:', id);
              } catch (err: any) {
                console.error('[ClosetScreen] Failed to delete', err);
                Alert.alert('Error', 'Could not delete this item. Please try again.');
              }
            },
          },
        ],
      );
    },
    [remove, user]
  );

  useEffect(() => {
    if (isFocused && user) {
      loadWardrobe();
    } else if (!user) {
      // Clear items when logging out
      setItems([]);
    }
  }, [isFocused, user]);

  // Show login prompt if user is not authenticated
  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, padding: theme.spacing.xl, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <Text style={{ fontSize: theme.typography.xl, fontWeight: theme.typography.semibold, marginBottom: theme.spacing.sm, color: theme.colors.textPrimary }}>
          Sign in to see your wardrobe
        </Text>
        <Text style={{ textAlign: 'center', color: theme.colors.textSecondary, marginBottom: theme.spacing.lg, lineHeight: theme.typography.base * theme.typography.lineHeight }}>
          Upload outfits, manage your closet, and let Myra suggest looks just for you.
        </Text>
        <Pressable
          onPress={() => navigation.replace('Login')}
          style={{
            backgroundColor: theme.colors.accent,
            paddingHorizontal: theme.spacing.xl,
            paddingVertical: theme.spacing.md,
            borderRadius: theme.borderRadius.lg,
          }}
        >
          <Text style={{ color: theme.colors.white, fontWeight: theme.typography.semibold }}>Go to login</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (loading && items.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator color={theme.colors.accent} />
        <Text style={{ marginTop: theme.spacing.md, color: theme.colors.textSecondary, fontSize: theme.typography.base }}>Loading your wardrobe...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {items.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing['4xl'] }}>
          <Ionicons name="shirt-outline" size={48} color={theme.colors.textSecondary} />
          <Text style={{ textAlign: "center", fontSize: theme.typography.base, color: theme.colors.textSecondary, lineHeight: theme.typography.base * theme.typography.lineHeight, marginTop: theme.spacing.md }}>
            Your closet is empty. Use the Scan tab to add garments.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={({ item }) => (
            <ClothingCard
              item={item}
              onDelete={handleDeleteItem}
              onToggleFavorite={handleToggleFavorite}
            />
          )}
        />
      )}
    </View>
  );
}
