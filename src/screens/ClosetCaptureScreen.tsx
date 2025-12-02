import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Alert,
  Modal,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  SafeAreaView,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../context/AuthContext";
import { useCloset } from "../store/closet";
import { useTheme } from "../context/ThemeContext";
import { hapticFeedback } from "../utils/haptics";
import ClothingCard from "../components/ClothingCard";
import {
  fetchWardrobeItems,
  uploadWardrobeImage,
  analyzeWardrobeImage,
  createWardrobeItem,
  toggleFavorite,
  deleteWardrobeItem,
  WardrobeItemResponse,
  WardrobeAnalyzeResponse,
} from "../api/wardrobe";
import { Garment, GarmentCategory, ColorName, FashionMetadata } from "../types";

const CATEGORIES: GarmentCategory[] = ["top", "bottom", "dress", "outerwear", "shoes", "accessory"];
const COLORS: ColorName[] = ["black", "white", "gray", "blue", "green", "red", "yellow", "beige", "brown", "pink", "purple"];

type ClosetCategoryFilter = "all" | "top" | "bottom" | "outerwear" | "shoes" | "accessory" | "favorites";

const FILTER_OPTIONS: { key: ClosetCategoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "top", label: "Tops" },
  { key: "bottom", label: "Bottoms" },
  { key: "outerwear", label: "Outerwear" },
  { key: "shoes", label: "Shoes" },
  { key: "accessory", label: "Accessories" },
  { key: "favorites", label: "Favorites" },
];

export default function ClosetCaptureScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const theme = useTheme();
  const isFocused = useIsFocused();

  const items = useCloset((state) => state.items);
  const setItems = useCloset((state) => state.setItems);
  const add = useCloset((state) => state.add);
  const remove = useCloset((state) => state.remove);
  const updateItem = useCloset((state) => state.updateItem);

  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [category, setCategory] = useState<GarmentCategory>("top");
  const [color, setColor] = useState<ColorName>("black");
  const [note, setNote] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<WardrobeAnalyzeResponse | null>(null);
  const [cleanImageUrl, setCleanImageUrl] = useState<string | undefined>(undefined);
  const [previewItem, setPreviewItem] = useState<Garment | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ClosetCategoryFilter>("all");

  const loadWardrobe = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }

    try {
      setLoading(true);
      console.log("[ClosetCaptureScreen] Fetching wardrobe items from backend...");
      const data: WardrobeItemResponse[] = await fetchWardrobeItems();

      const mapped: Garment[] = data.map((item) => ({
        id: item._id,
        imageUrl: item.imageUrl,
        cleanImageUrl: item.cleanImageUrl,
        category: item.category as GarmentCategory,
        colors: (item.colors ?? []) as ColorName[],
        notes: item.notes,
        isFavorite: item.isFavorite ?? false,
        tags: item.tags ?? [],
        metadata: item.metadata,
      }));

      setItems(mapped);
      console.log("[ClosetCaptureScreen] Wardrobe items loaded:", mapped.length);
    } catch (err: any) {
      console.error("[ClosetCaptureScreen] Failed to fetch wardrobe:", err);
      Alert.alert(
        "Error",
        err?.message || "Failed to load your wardrobe. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [user, setItems]);

  useEffect(() => {
    if (isFocused && user) {
      loadWardrobe();
    } else if (!user) {
      setItems([]);
    }
  }, [isFocused, user, loadWardrobe, setItems]);

  const handleToggleFavorite = useCallback(
    async (id: string, next: boolean) => {
      const prev = items.find((item) => item.id === id);
      const prevIsFavorite = prev?.isFavorite ?? !next;

      updateItem(id, { isFavorite: next });

      try {
        const updated = await toggleFavorite(id, next);
        updateItem(id, {
          isFavorite: updated.isFavorite,
        });
      } catch (err: any) {
        updateItem(id, { isFavorite: prevIsFavorite });
        Alert.alert("Error", "Could not update favorite. Please try again.");
      }
    },
    [items, updateItem]
  );

  const handleDeleteItem = useCallback(
    (id: string) => {
      if (!user) return;

      Alert.alert(
        "Delete item?",
        "This will remove this clothing item from your Myra wardrobe.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteWardrobeItem(id);
                remove(id);
              } catch (err: any) {
                Alert.alert("Error", "Could not delete this item. Please try again.");
              }
            },
          },
        ]
      );
    },
    [remove, user]
  );

  const takePicture = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Camera permission is needed to take photos.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
        setShowAddModal(true);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to take picture. Please try again.");
    }
  };

  const handleAnalyze = async () => {
    if (!user) {
      Alert.alert("Not logged in", "Please log in before adding items to your wardrobe.");
      return;
    }

    if (!selectedImage) {
      Alert.alert("No image", "Please take a photo first.");
      return;
    }

    try {
      setIsAnalyzing(true);

      const { imageUrl, cleanImageUrl: uploadedCleanImageUrl } = await uploadWardrobeImage(selectedImage);
      setCleanImageUrl(uploadedCleanImageUrl);

      const result = await analyzeWardrobeImage({
        imageUrl,
        category,
        colors: color ? [color] : [],
        notes: note || "",
      });

      setAnalysisResult(result);
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to analyze image. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!user || !analysisResult) {
      return;
    }

    try {
      setIsSaving(true);

      const created: WardrobeItemResponse = await createWardrobeItem({
        imageUrl: analysisResult.imageUrl,
        cleanImageUrl: cleanImageUrl,
        category,
        colors: color ? [color] : [],
        notes: note || undefined,
      });

      const garment: Garment = {
        id: created._id,
        imageUrl: created.imageUrl,
        cleanImageUrl: created.cleanImageUrl,
        category: created.category as GarmentCategory,
        colors: (created.colors ?? []) as ColorName[],
        notes: created.notes,
        isFavorite: created.isFavorite,
        tags: created.tags,
        metadata: created.metadata,
      };

      add(garment);
      hapticFeedback.success();

      resetForm();
      Alert.alert("Saved", "Item saved to your closet.");
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to save item. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedImage(null);
    setCategory("top");
    setColor("black");
    setNote("");
    setAnalysisResult(null);
    setCleanImageUrl(undefined);
    setShowAddModal(false);
  };

  // Filter items by selected category
  const filteredItems = useMemo(() => {
    if (selectedCategory === "all") return items;
    
    if (selectedCategory === "favorites") {
      return items.filter((item) => item.isFavorite === true);
    }

    return items.filter((item) => {
      switch (selectedCategory) {
        case "top":
          return item.category === "top";
        case "bottom":
          return item.category === "bottom";
        case "outerwear":
          return item.category === "outerwear";
        case "shoes":
          return item.category === "shoes";
        case "accessory":
          return item.category === "accessory";
        default:
          return true;
      }
    });
  }, [items, selectedCategory]);

  // Auth guard
  if (!user) {
    return (
      <SafeAreaView style={styles(theme).authContainer}>
        <Text style={styles(theme).authTitle}>Sign in to see your wardrobe</Text>
        <Text style={styles(theme).authSubtext}>
          Upload outfits, manage your closet, and let Myra suggest looks just for you.
        </Text>
        <Pressable
          onPress={() => navigation.navigate("Login")}
          style={styles(theme).authButton}
        >
          <Text style={styles(theme).authButtonText}>Go to login</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const themeStyles = styles(theme);

  return (
    <View style={themeStyles.container}>
      <SafeAreaView style={themeStyles.safeArea} edges={["top"]}>
        <ScrollView
          style={themeStyles.scrollView}
          contentContainerStyle={themeStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={themeStyles.header}>
            <Text style={themeStyles.title}>My Closet</Text>
            <Text style={themeStyles.subtitle}>
              Upload pieces and let MYRA style them for you.
            </Text>
          </View>

          {/* Add from camera card */}
          <Pressable
            onPress={async () => {
              hapticFeedback.light();
              await takePicture();
            }}
            style={themeStyles.addCard}
          >
            <Ionicons name="shirt-outline" size={32} color={theme.colors.accent} />
            <View style={themeStyles.addCardText}>
              <Text style={themeStyles.addCardTitle}>Add a new piece</Text>
              <Text style={themeStyles.addCardSubtext}>
                Open camera to capture a new clothing item
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </Pressable>

          {/* Category filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={themeStyles.filterChipsContainer}
          >
            {FILTER_OPTIONS.map((filter) => {
              const isSelected = selectedCategory === filter.key;
              return (
                <Pressable
                  key={filter.key}
                  onPress={() => {
                    hapticFeedback.light();
                    setSelectedCategory(filter.key);
                  }}
                  style={[
                    themeStyles.filterChip,
                    isSelected && themeStyles.filterChipActive,
                  ]}
                >
                  <Text
                    style={[
                      themeStyles.filterChipText,
                      isSelected && themeStyles.filterChipTextActive,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Loading state */}
          {loading && items.length === 0 ? (
            <View style={themeStyles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
              <Text style={themeStyles.loadingText}>Loading your wardrobe...</Text>
            </View>
          ) : (
            <>
              {/* Filtered wardrobe list */}
              {items.length === 0 && !loading ? (
                <View style={themeStyles.emptyState}>
                  <Ionicons name="shirt-outline" size={64} color={theme.colors.textTertiary} />
                  <Text style={themeStyles.emptyText}>
                    Your closet is empty. Add your first piece!
                  </Text>
                </View>
              ) : filteredItems.length === 0 ? (
                <View style={themeStyles.emptyState}>
                  <Ionicons name="shirt-outline" size={64} color={theme.colors.textTertiary} />
                  <Text style={themeStyles.emptyText}>
                    {selectedCategory === "favorites"
                      ? "No favorite items yet. Tap the ♥ on a piece to favorite it."
                      : selectedCategory === "top"
                      ? "No tops yet. Add a new piece to this folder."
                      : selectedCategory === "bottom"
                      ? "No bottoms yet. Add a new piece to this folder."
                      : selectedCategory === "outerwear"
                      ? "No outerwear yet. Add a new piece to this folder."
                      : selectedCategory === "shoes"
                      ? "No shoes yet. Add a new piece to this folder."
                      : selectedCategory === "accessory"
                      ? "No accessories yet. Add a new piece to this folder."
                      : "No items in this folder yet. Add a new piece."}
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={filteredItems}
                  keyExtractor={(item) => item.id}
                  numColumns={2}
                  scrollEnabled={false}
                  columnWrapperStyle={{
                    columnGap: theme.spacing.md,
                    paddingHorizontal: theme.spacing.lg,
                    marginBottom: theme.spacing.md,
                  }}
                  contentContainerStyle={themeStyles.listContainer}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => {
                        hapticFeedback.light();
                        setPreviewItem(item);
                      }}
                      style={{ flex: 1 }}
                    >
                      <ClothingCard
                        item={item}
                        onDelete={handleDeleteItem}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    </Pressable>
                  )}
                />
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Add item modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={resetForm}
      >
        <View style={themeStyles.modalContainer}>
          <View style={themeStyles.modalHeader}>
            <Pressable onPress={resetForm}>
              <Text style={themeStyles.modalCancel}>Cancel</Text>
            </Pressable>
            <Text style={themeStyles.modalTitle}>Add Item</Text>
            <Pressable
              onPress={handleAnalyze}
              disabled={!selectedImage || isAnalyzing}
              style={{ opacity: !selectedImage || isAnalyzing ? 0.6 : 1 }}
            >
              {isAnalyzing ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                  <Text style={themeStyles.modalAction}>Analyzing...</Text>
                </View>
              ) : (
                <Text style={themeStyles.modalAction}>Analyze</Text>
              )}
            </Pressable>
          </View>

          <ScrollView style={themeStyles.modalContent}>
            {/* Image selection */}
            <View style={themeStyles.modalSection}>
              <Text style={themeStyles.modalSectionTitle}>Add Photo</Text>
              {selectedImage ? (
                <View style={themeStyles.imageContainer}>
                  <Image source={{ uri: selectedImage }} style={themeStyles.selectedImage} />
                  <Pressable
                    style={themeStyles.changeImageButton}
                    onPress={() => {
                      setSelectedImage(null);
                      setAnalysisResult(null);
                    }}
                  >
                    <Ionicons name="close" size={20} color={theme.colors.white} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={themeStyles.cameraButton}
                  onPress={async () => {
                    await takePicture();
                  }}
                >
                  <Ionicons name="camera" size={32} color={theme.colors.accent} />
                  <Text style={themeStyles.cameraButtonText}>Take Photo</Text>
                </Pressable>
              )}
            </View>

            {/* Category selection */}
            <View style={themeStyles.modalSection}>
              <Text style={themeStyles.modalSectionTitle}>Category</Text>
              <View style={themeStyles.categoryGrid}>
                {CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat}
                    style={[
                      themeStyles.categoryChip,
                      category === cat && themeStyles.categoryChipActive,
                    ]}
                    onPress={() => {
                      hapticFeedback.light();
                      setCategory(cat);
                    }}
                  >
                    <Text
                      style={[
                        themeStyles.categoryChipText,
                        category === cat && themeStyles.categoryChipTextActive,
                      ]}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Color selection */}
            <View style={themeStyles.modalSection}>
              <Text style={themeStyles.modalSectionTitle}>Primary Color</Text>
              <View style={themeStyles.colorGrid}>
                {COLORS.map((col) => (
                  <Pressable
                    key={col}
                    style={[
                      themeStyles.colorChip,
                      color === col && themeStyles.colorChipActive,
                    ]}
                    onPress={() => {
                      hapticFeedback.light();
                      setColor(col);
                    }}
                  >
                    <Text
                      style={[
                        themeStyles.colorChipText,
                        color === col && themeStyles.colorChipTextActive,
                      ]}
                    >
                      {col.charAt(0).toUpperCase() + col.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Notes */}
            <View style={themeStyles.modalSection}>
              <Text style={themeStyles.modalSectionTitle}>Notes (Optional)</Text>
              <TextInput
                style={themeStyles.notesInput}
                placeholder="Add any notes about this item..."
                placeholderTextColor={theme.colors.textTertiary}
                value={note}
                onChangeText={setNote}
                multiline
              />
            </View>

            {/* Save button (only shown after analysis) */}
            {analysisResult && (
              <Pressable
                style={[
                  themeStyles.saveButton,
                  isSaving && { opacity: 0.6 },
                ]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator size="small" color={theme.colors.white} />
                    <Text style={themeStyles.saveButtonText}>Saving...</Text>
                  </View>
                ) : (
                  <Text style={themeStyles.saveButtonText}>Looks good, save item</Text>
                )}
              </Pressable>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Full-screen preview modal */}
      <Modal
        visible={!!previewItem}
        animationType="fade"
        transparent
        onRequestClose={() => setPreviewItem(null)}
      >
        <View style={themeStyles.previewContainer}>
          <Pressable
            style={themeStyles.previewCloseButton}
            onPress={() => setPreviewItem(null)}
          >
            <Ionicons name="close" size={28} color={theme.colors.white} />
          </Pressable>
          {previewItem && (
            <View style={themeStyles.previewContent}>
              <Image
                source={{
                  uri: previewItem.cleanImageUrl || previewItem.imageUrl || previewItem.uri || "",
                }}
                style={themeStyles.previewImage}
                resizeMode="contain"
              />
              <View style={themeStyles.previewMetadata}>
                <Text style={themeStyles.previewCategory}>
                  {previewItem.category.toUpperCase()}
                </Text>
                {previewItem.colors.length > 0 && (
                  <Text style={themeStyles.previewColors}>
                    Colors: {previewItem.colors.join(", ")}
                  </Text>
                )}
                {previewItem.notes && (
                  <Text style={themeStyles.previewNotes}>{previewItem.notes}</Text>
                )}
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    safeArea: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: theme.spacing.xl,
    },
    authContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.xl,
    },
    authTitle: {
      fontSize: theme.typography.xl,
      fontWeight: theme.typography.semibold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
      textAlign: "center",
    },
    authSubtext: {
      fontSize: theme.typography.base,
      color: theme.colors.textSecondary,
      textAlign: "center",
      marginBottom: theme.spacing.xl,
      lineHeight: theme.typography.base * theme.typography.lineHeight,
    },
    authButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.lg,
    },
    authButtonText: {
      color: theme.colors.white,
      fontSize: theme.typography.base,
      fontWeight: theme.typography.semibold,
    },
    header: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
    },
    title: {
      fontSize: theme.typography["3xl"],
      fontWeight: theme.typography.bold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    subtitle: {
      fontSize: theme.typography.base,
      color: theme.colors.textSecondary,
      lineHeight: theme.typography.base * theme.typography.lineHeight,
    },
    addCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.lg,
      marginHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...theme.shadows.sm,
    },
    addCardText: {
      flex: 1,
      marginLeft: theme.spacing.md,
    },
    addCardTitle: {
      fontSize: theme.typography.lg,
      fontWeight: theme.typography.semibold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    addCardSubtext: {
      fontSize: theme.typography.sm,
      color: theme.colors.textSecondary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: theme.spacing["4xl"],
    },
    loadingText: {
      marginTop: theme.spacing.md,
      fontSize: theme.typography.base,
      color: theme.colors.textSecondary,
    },
    filterChipsContainer: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    filterChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundSecondary,
    },
    filterChipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    filterChipText: {
      fontSize: theme.typography.sm,
      fontWeight: theme.typography.medium,
      color: theme.colors.textSecondary,
    },
    filterChipTextActive: {
      color: theme.colors.white,
    },
    listContainer: {
      paddingHorizontal: theme.spacing.lg,
    },
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: theme.spacing["4xl"],
    },
    emptyText: {
      fontSize: theme.typography.base,
      color: theme.colors.textSecondary,
      textAlign: "center",
      marginTop: theme.spacing.md,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalCancel: {
      fontSize: theme.typography.base,
      color: theme.colors.textSecondary,
    },
    modalTitle: {
      fontSize: theme.typography.lg,
      fontWeight: theme.typography.bold,
      color: theme.colors.textPrimary,
    },
    modalAction: {
      fontSize: theme.typography.base,
      color: theme.colors.accent,
      fontWeight: theme.typography.semibold,
    },
    modalContent: {
      flex: 1,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
    },
    modalSection: {
      marginBottom: theme.spacing.xl,
    },
    modalSectionTitle: {
      fontSize: theme.typography.base,
      fontWeight: theme.typography.semibold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.md,
    },
    imageContainer: {
      position: "relative",
      alignItems: "center",
    },
    selectedImage: {
      width: 200,
      height: 200,
      borderRadius: theme.borderRadius.lg,
    },
    changeImageButton: {
      position: "absolute",
      top: 8,
      right: 8,
      backgroundColor: theme.colors.error,
      borderRadius: theme.borderRadius.full,
      width: 32,
      height: 32,
      justifyContent: "center",
      alignItems: "center",
    },
    cameraButton: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.xl,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderStyle: "dashed",
    },
    cameraButtonText: {
      marginTop: theme.spacing.sm,
      fontSize: theme.typography.base,
      color: theme.colors.accent,
      fontWeight: theme.typography.medium,
    },
    categoryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    categoryChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundSecondary,
    },
    categoryChipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    categoryChipText: {
      fontSize: theme.typography.sm,
      fontWeight: theme.typography.medium,
      color: theme.colors.textSecondary,
    },
    categoryChipTextActive: {
      color: theme.colors.white,
    },
    colorGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    colorChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundSecondary,
    },
    colorChipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    colorChipText: {
      fontSize: theme.typography.sm,
      fontWeight: theme.typography.medium,
      color: theme.colors.textSecondary,
    },
    colorChipTextActive: {
      color: theme.colors.white,
    },
    notesInput: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      minHeight: 100,
      fontSize: theme.typography.base,
      color: theme.colors.textPrimary,
    },
    saveButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.borderRadius.lg,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      alignItems: "center",
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
    },
    saveButtonText: {
      color: theme.colors.white,
      fontSize: theme.typography.base,
      fontWeight: theme.typography.bold,
    },
    previewContainer: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.95)",
      justifyContent: "center",
      alignItems: "center",
    },
    previewCloseButton: {
      position: "absolute",
      top: 50,
      right: theme.spacing.lg,
      zIndex: 10,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      borderRadius: theme.borderRadius.full,
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
    },
    previewContent: {
      width: "100%",
      alignItems: "center",
      padding: theme.spacing.lg,
    },
    previewImage: {
      width: "100%",
      height: "70%",
      maxHeight: 600,
    },
    previewMetadata: {
      marginTop: theme.spacing.xl,
      alignItems: "center",
    },
    previewCategory: {
      fontSize: theme.typography.base,
      fontWeight: theme.typography.bold,
      color: theme.colors.white,
      marginBottom: theme.spacing.sm,
    },
    previewColors: {
      fontSize: theme.typography.base,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xs,
    },
    previewNotes: {
      fontSize: theme.typography.base,
      color: theme.colors.textSecondary,
      textAlign: "center",
    },
  });

