import React from "react";
import { View, Image, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Garment } from "../types";
import { useTheme } from "../context/ThemeContext";

export default function ClothingCard({
  item,
  onDelete,
  onToggleFavorite,
}: {
  item: Garment;
  onDelete?: (id: string) => void;
  onToggleFavorite?: (id: string, next: boolean) => void;
}) {
  const theme = useTheme();
  const isFavorite = item.isFavorite === true;

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item.imageUrl || item.uri }}
          style={styles.image}
          resizeMode="cover"
        />
        {onToggleFavorite && (
          <Pressable
            onPress={() => onToggleFavorite(item.id, !isFavorite)}
            style={styles.favoriteButton}
          >
            <Ionicons
              name={isFavorite ? "heart" : "heart-outline"}
              size={20}
              color={isFavorite ? theme.colors.error : theme.colors.textTertiary}
            />
          </Pressable>
        )}
        {onDelete && (
          <Pressable
            onPress={() => onDelete(item.id)}
            style={styles.deleteButtonOverlay}
          >
            <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
          </Pressable>
        )}
      </View>
      <View style={styles.content}>
        <Text style={styles.category}>{item.category.toUpperCase()}</Text>
        {item.colors.length > 0 && (
          <Text style={styles.colors} numberOfLines={1}>
            {item.colors.slice(0, 2).join(", ")}
          </Text>
        )}
      </View>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.lg,
      overflow: "hidden",
      backgroundColor: theme.colors.backgroundSecondary,
    },
    imageContainer: {
      position: "relative",
      width: "100%",
      aspectRatio: 1,
    },
    image: {
      width: "100%",
      height: "100%",
    },
    favoriteButton: {
      position: "absolute",
      top: theme.spacing.xs,
      right: theme.spacing.xs,
      backgroundColor: theme.colors.background + "E6",
      borderRadius: theme.borderRadius.full,
      width: 32,
      height: 32,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: theme.colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    deleteButtonOverlay: {
      position: "absolute",
      bottom: theme.spacing.xs,
      right: theme.spacing.xs,
      backgroundColor: theme.colors.background + "E6",
      borderRadius: theme.borderRadius.md,
      width: 28,
      height: 28,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: theme.colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    content: {
      padding: theme.spacing.sm,
      paddingTop: theme.spacing.xs,
      gap: 2,
    },
    category: {
      fontSize: theme.typography.xs,
      fontWeight: theme.typography.semibold,
      color: theme.colors.textPrimary,
    },
    colors: {
      fontSize: theme.typography.xs - 1,
      color: theme.colors.textSecondary,
    },
  });
