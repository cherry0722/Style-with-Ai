import React, { useEffect, useState, useCallback } from "react";
import { View, FlatList, Text, ActivityIndicator, Alert } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import ClothingCard from "../components/ClothingCard";
import { useCloset } from "../store/closet";
import { fetchWardrobeItems, toggleFavorite, WardrobeItemResponse } from "../api/wardrobe";
import { Garment } from "../types";

export default function ClosetScreen() {
  const [loading, setLoading] = useState(false);
  const isFocused = useIsFocused();

  const items = useCloset((state) => state.items);
  const setItems = useCloset((state) => state.setItems);
  const remove = useCloset((state) => state.remove);
  const updateItem = useCloset((state) => state.updateItem);

  const loadWardrobe = async () => {
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

  useEffect(() => {
    if (isFocused) {
      loadWardrobe();
    }
  }, [isFocused]);

  if (loading && items.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 12, color: '#666' }}>Loading your wardrobe...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {items.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
          <Text style={{ textAlign: "center", fontSize: 16, color: "#666" }}>
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
              onDelete={(id) => remove(id)}
              onToggleFavorite={handleToggleFavorite}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </View>
  );
}
