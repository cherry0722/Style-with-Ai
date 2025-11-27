import React from "react";
import { View, Image, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Garment } from "../types";

export default function ClothingCard({
  item,
  onDelete,
  onToggleFavorite,
}: {
  item: Garment;
  onDelete?: (id: string) => void;
  onToggleFavorite?: (id: string, next: boolean) => void;
}) {
  const isFavorite = item.isFavorite === true;

  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item.imageUrl || item.uri }}
          style={styles.image}
        />
        {onToggleFavorite && (
          <Pressable
            onPress={() => onToggleFavorite(item.id, !isFavorite)}
            style={styles.favoriteButton}
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={24}
              color={isFavorite ? "#f33" : "#666"}
            />
          </Pressable>
        )}
      </View>
      <View style={styles.content}>
        <Text style={styles.category}>{item.category.toUpperCase()}</Text>
        <Text style={styles.colors}>Colors: {item.colors.join(", ")}</Text>
        {onDelete && (
          <Pressable
            onPress={() => onDelete(item.id)}
            style={styles.deleteButton}
          >
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 16,
    overflow: "hidden",
  },
  imageContainer: {
    position: "relative",
  },
  image: {
    width: "100%",
    height: 160,
  },
  favoriteButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    padding: 10,
    gap: 4,
  },
  category: {
    fontWeight: "700",
  },
  colors: {
    color: "#555",
  },
  deleteButton: {
    padding: 8,
    backgroundColor: "#f33",
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  deleteText: {
    color: "#fff",
    fontWeight: "700",
  },
});
