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
  Platform,
  ActionSheetIOS,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
type AddFlowStep = "idle" | "analyzing" | "review" | "error";

const FILTER_OPTIONS: { key: ClosetCategoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "top", label: "Tops" },
  { key: "bottom", label: "Bottoms" },
  { key: "outerwear", label: "Outerwear" },
  { key: "shoes", label: "Shoes" },
  { key: "accessory", label: "Accessories" },
  { key: "favorites", label: "Favorites" },
];

const META_TYPE_OPTIONS = [
  "t-shirt",
  "shirt",
  "polo",
  "hoodie",
  "sweater",
  "jeans",
  "trousers",
  "shorts",
  "skirt",
  "dress",
  "jacket",
  "coat",
  "shoes",
  "sneakers",
  "boots",
  "heels",
];

const META_PATTERN_OPTIONS = [
  "solid",
  "striped",
  "plaid",
  "checkered",
  "printed",
  "floral",
  "graphic",
  "color-block",
];

const META_FIT_OPTIONS = [
  "regular",
  "slim",
  "relaxed",
  "oversized",
  "tailored",
];

const META_COLOR_NAME_OPTIONS: ColorName[] = COLORS;

const META_COLOR_TONE_OPTIONS = [
  "neutral",
  "warm",
  "cool",
  "bold",
  "pastel",
] as const;

const META_FABRIC_OPTIONS = [
  "cotton",
  "denim",
  "wool",
  "linen",
  "silk",
  "polyester",
  "leather",
  "synthetic",
  "unknown",
];

const STYLE_VIBE_OPTIONS = [
  "casual",
  "minimal",
  "streetwear",
  "sporty",
  "formal",
  "party",
];

const normalizeCategory = (value?: string | null, fallback: GarmentCategory = "top"): GarmentCategory => {
  if (!value) return fallback;
  const lower = value.toLowerCase();
  if (lower === "unknown") return fallback;
  if (lower.includes("dress")) return "dress";
  if (lower.includes("coat") || lower.includes("jacket") || lower.includes("outerwear") || lower.includes("hoodie"))
    return "outerwear";
  if (lower.startsWith("top")) return "top";
  if (lower.startsWith("bottom") || lower.includes("pant") || lower.includes("jean") || lower.includes("skirt"))
    return "bottom";
  if (lower.includes("shoe") || lower.includes("sneaker") || lower.includes("boot"))
    return "shoes";
  if (lower.includes("accessor")) return "accessory";
  return fallback;
};

const normalizeColorToPalette = (value?: string | null): ColorName | null => {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === "unknown") return null;
  const match = COLORS.find((color) => lower.includes(color));
  return match ?? null;
};

const isDefined = <T,>(value: T | null | undefined): value is T => value !== null && value !== undefined;

const buildTagList = (analysis?: WardrobeAnalyzeResponse | null): string[] => {
  if (!analysis) {
    return [];
  }
  const azure = Array.isArray(analysis.azure_tags) ? analysis.azure_tags : [];
  return Array.from(
    new Set(
      azure
        .map((tag) => (typeof tag === "string" ? tag.trim().toLowerCase() : ""))
        .filter((tag) => tag.length > 0)
    )
  ).slice(0, 20);
};

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
  const [addStep, setAddStep] = useState<AddFlowStep>("idle");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [reviewCategory, setReviewCategory] = useState<GarmentCategory>("top");
  const [reviewColor, setReviewColor] = useState<ColorName | null>(null);
  const [metaType, setMetaType] = useState<string | null>(null);
  const [metaPattern, setMetaPattern] = useState<string | null>(null);
  const [metaFit, setMetaFit] = useState<string | null>(null);
  const [metaColorName, setMetaColorName] = useState<string | null>(null);
  const [metaColorTone, setMetaColorTone] = useState<string | null>(null);
  const [metaFabric, setMetaFabric] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<WardrobeAnalyzeResponse | null>(null);
  const [cleanImageUrl, setCleanImageUrl] = useState<string | undefined>(undefined);
  const [previewItem, setPreviewItem] = useState<Garment | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ClosetCategoryFilter>("all");
  const [selectedStyleVibes, setSelectedStyleVibes] = useState<string[]>([]);

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

  const runAnalysis = useCallback(
    async (uri: string) => {
      try {
        setIsAnalyzing(true);
        setAnalysisError(null);
        setAddStep("analyzing");

        const { imageUrl, cleanImageUrl: uploadedCleanImageUrl } = await uploadWardrobeImage(uri);
        setCleanImageUrl(uploadedCleanImageUrl);

        const result = await analyzeWardrobeImage({
          imageUrl,
        });

        setAnalysisResult(result);

        const rawLLMCategory = result.llm_metadata?.category as string | undefined;
        const llmCategory =
          rawLLMCategory && rawLLMCategory !== "unknown"
            ? normalizeCategory(rawLLMCategory)
            : null;
        const hintCategory = result.category_hint ? normalizeCategory(result.category_hint) : null;
        setReviewCategory(llmCategory || hintCategory || "top");

        const inferredColor =
          normalizeColorToPalette(result.color_hint) ||
          normalizeColorToPalette(result.llm_metadata?.color_name) ||
          normalizeColorToPalette(result.azure_colors?.dominantColors?.[0]) ||
          null;
        setReviewColor(inferredColor);

        const baseMeta = (result.llm_metadata || {}) as FashionMetadata;
        const pickFromOptions = (val: string | undefined, opts: readonly string[]) => {
          if (!val) return null;
          const lower = val.toLowerCase();
          return opts.find((opt) => opt.toLowerCase() === lower) || null;
        };

        setMetaType(pickFromOptions(baseMeta.type, META_TYPE_OPTIONS));
        setMetaPattern(pickFromOptions(baseMeta.pattern, META_PATTERN_OPTIONS));
        setMetaFit(pickFromOptions(baseMeta.fit, META_FIT_OPTIONS));
        setMetaColorName(
          pickFromOptions(baseMeta.color_name, META_COLOR_NAME_OPTIONS as unknown as string[])
        );
        setMetaColorTone(pickFromOptions(baseMeta.color_type, META_COLOR_TONE_OPTIONS));
        setMetaFabric(pickFromOptions(baseMeta.fabric, META_FABRIC_OPTIONS));

        const baseStyleTags = Array.isArray(baseMeta.style_tags) ? baseMeta.style_tags : [];
        const initialVibes = STYLE_VIBE_OPTIONS.filter((opt) =>
          baseStyleTags.some((tag) => typeof tag === "string" && tag.toLowerCase() === opt.toLowerCase())
        );
        setSelectedStyleVibes(initialVibes);
        setAddStep("review");
      } catch (err: any) {
        console.error("[ClosetCaptureScreen] Analysis failed:", err);
        setAnalysisError(err?.message || "Failed to analyze image. Please try again.");
        setAddStep("error");
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  const openAddFlowWithImage = useCallback(
    (uri: string) => {
      setSelectedImage(uri);
      setShowAddModal(true);
      setAnalysisResult(null);
      setReviewCategory("top");
      setReviewColor(null);
      setMetaType(null);
      setMetaPattern(null);
      setMetaFit(null);
      setMetaColorName(null);
      setMetaColorTone(null);
      setMetaFabric(null);
      setSelectedStyleVibes([]);
      setNote("");
      setCleanImageUrl(undefined);
      setAddStep("analyzing");
      runAnalysis(uri);
    },
    [runAnalysis]
  );

  const pickImageFromCamera = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Camera permission is needed to take photos.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets?.length) {
        openAddFlowWithImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("[ClosetCaptureScreen] Camera launch failed:", error);
      Alert.alert("Error", "Failed to take picture. Please try again.");
    }
  }, [openAddFlowWithImage]);

  const pickImageFromLibrary = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Library access is needed to pick photos.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets?.length) {
        openAddFlowWithImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error("[ClosetCaptureScreen] Library pick failed:", error);
      Alert.alert("Error", "Failed to choose a photo. Please try again.");
    }
  }, [openAddFlowWithImage]);

  const showImageSourceSheet = useCallback(() => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take photo", "Choose from library"],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            pickImageFromCamera();
          } else if (buttonIndex === 2) {
            pickImageFromLibrary();
          }
        }
      );
    } else {
      Alert.alert("Add a new piece", "Choose an image source", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Take photo",
          onPress: () => {
            pickImageFromCamera();
          },
        },
        {
          text: "Choose from gallery",
          onPress: () => {
            pickImageFromLibrary();
          },
        },
      ]);
    }
  }, [pickImageFromCamera, pickImageFromLibrary]);

  const toggleStyleVibe = useCallback((vibe: string) => {
    setSelectedStyleVibes((prev) =>
      prev.includes(vibe)
        ? prev.filter((existing) => existing !== vibe)
        : [...prev, vibe]
    );
  }, []);

  const handleSave = async () => {
    if (!user || !analysisResult) {
      return;
    }

    try {
      setIsSaving(true);

      // Prefer user-selected primary color; fall back to Azure dominantColors
      const fallbackColors = (analysisResult.azure_colors?.dominantColors || [])
        .map((entry) => normalizeColorToPalette(entry))
        .filter(isDefined);
      const inferredColors: ColorName[] = reviewColor ? [reviewColor] : fallbackColors;

      // Build editable metadata, starting from LLM base
      const baseMeta = (analysisResult.llm_metadata || {}) as FashionMetadata;
      const finalMetadata: FashionMetadata = {
        ...baseMeta,
        type: metaType ?? baseMeta.type ?? "unknown",
        pattern: metaPattern ?? baseMeta.pattern ?? "unknown",
        fit: metaFit ?? baseMeta.fit ?? "unknown",
        color_name: metaColorName ?? baseMeta.color_name ?? "unknown",
        color_type: (metaColorTone ?? baseMeta.color_type ?? "unknown") as FashionMetadata["color_type"],
        fabric: metaFabric ?? baseMeta.fabric ?? "unknown",
        style_tags:
          selectedStyleVibes.length > 0
            ? selectedStyleVibes
            : baseMeta.style_tags ?? [],
      };

      const created: WardrobeItemResponse = await createWardrobeItem({
        imageUrl: analysisResult.imageUrl,
        cleanImageUrl: cleanImageUrl,
        category: reviewCategory,
        colors: inferredColors.length > 0 ? inferredColors : undefined,
        notes: note || undefined,
        metadata: finalMetadata,
        tags: analysisResult.azure_tags || [],
        styleVibe: selectedStyleVibes.length > 0 ? selectedStyleVibes : undefined,
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
    setReviewCategory("top");
    setReviewColor(null);
    setMetaType(null);
    setMetaPattern(null);
    setMetaFit(null);
    setMetaColorName(null);
    setMetaColorTone(null);
    setMetaFabric(null);
    setSelectedStyleVibes([]);
    setNote("");
    setAnalysisResult(null);
    setCleanImageUrl(undefined);
    setAnalysisError(null);
    setAddStep("idle");
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
            onPress={() => {
              hapticFeedback.light();
              showImageSourceSheet();
            }}
            style={themeStyles.addCard}
          >
            <Ionicons name="shirt-outline" size={32} color={theme.colors.accent} />
            <View style={themeStyles.addCardText}>
              <Text style={themeStyles.addCardTitle}>Add a new piece</Text>
              <Text style={themeStyles.addCardSubtext}>
                Capture or upload a new clothing item
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
            {addStep === "review" ? (
              <Pressable
                onPress={() => selectedImage && runAnalysis(selectedImage)}
                disabled={isAnalyzing}
                style={{ opacity: isAnalyzing ? 0.5 : 1 }}
              >
                <Text style={themeStyles.modalAction}>Re-run AI</Text>
              </Pressable>
            ) : addStep === "analyzing" ? (
              <View style={themeStyles.modalHeaderSpinner}>
                <ActivityIndicator size="small" color={theme.colors.accent} />
              </View>
            ) : (
              <View style={{ width: 64 }} />
            )}
          </View>

          <ScrollView style={themeStyles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={themeStyles.modalSection}>
              <Text style={themeStyles.modalSectionTitle}>Photo</Text>
              {selectedImage ? (
                <>
                  <View style={themeStyles.imageContainer}>
                    <Image source={{ uri: selectedImage }} style={themeStyles.selectedImage} />
                  </View>
                  <View style={themeStyles.photoActions}>
                    <Pressable
                      style={themeStyles.secondaryPhotoButton}
                      onPress={showImageSourceSheet}
                    >
                      <Ionicons name="refresh" size={16} color={theme.colors.accent} />
                      <Text style={themeStyles.secondaryPhotoButtonText}>Replace photo</Text>
                    </Pressable>
                    <Pressable
                      style={themeStyles.secondaryPhotoButton}
                      onPress={() => {
                        setSelectedImage(null);
                        setAnalysisResult(null);
                        setAddStep("idle");
                        setReviewColor(null);
                        setReviewCategory("top");
                        setCleanImageUrl(undefined);
                        setAnalysisError(null);
                        setMetaType(null);
                        setMetaPattern(null);
                        setMetaFit(null);
                        setMetaColorName(null);
                        setMetaColorTone(null);
                        setMetaFabric(null);
                        setSelectedStyleVibes([]);
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color={theme.colors.error} />
                      <Text style={[themeStyles.secondaryPhotoButtonText, { color: theme.colors.error }]}>
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Pressable style={themeStyles.cameraButton} onPress={showImageSourceSheet}>
                  <Ionicons name="images-outline" size={32} color={theme.colors.accent} />
                  <Text style={themeStyles.cameraButtonText}>Choose photo</Text>
                </Pressable>
              )}
            </View>

            {addStep === "analyzing" && (
              <View style={themeStyles.analysisState}>
                <ActivityIndicator size="large" color={theme.colors.accent} />
                <Text style={themeStyles.analysisTitle}>Analyzing your piece</Text>
                <Text style={themeStyles.analysisSubtitle}>
                  MYRA is uploading your photo and generating fashion tags automatically.
                </Text>
              </View>
            )}

            {addStep === "error" && (
              <View style={themeStyles.analysisState}>
                <Ionicons name="alert-circle" size={36} color={theme.colors.error} />
                <Text style={themeStyles.errorTitle}>We couldn’t analyze this photo</Text>
                <Text style={themeStyles.errorSubtitle}>{analysisError}</Text>
                <Pressable
                  style={themeStyles.retryButton}
                  onPress={() => selectedImage && runAnalysis(selectedImage)}
                >
                  <Text style={themeStyles.retryButtonText}>Try again</Text>
                </Pressable>
              </View>
            )}

            {addStep === "review" && analysisResult && (
              <>
                <View style={themeStyles.modalSection}>
                  <Text style={themeStyles.modalSectionTitle}>Category</Text>
                  <View style={themeStyles.categoryGrid}>
                    {CATEGORIES.map((cat) => {
                      const isActive = reviewCategory === cat;
                      return (
                        <Pressable
                          key={cat}
                          style={[
                            themeStyles.categoryChip,
                            isActive && themeStyles.categoryChipActive,
                          ]}
                          onPress={() => {
                            hapticFeedback.light();
                            setReviewCategory(cat);
                          }}
                        >
                          <Text
                            style={[
                              themeStyles.categoryChipText,
                              isActive && themeStyles.categoryChipTextActive,
                            ]}
                          >
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={themeStyles.modalSection}>
                  <Text style={themeStyles.modalSectionTitle}>Primary Color</Text>
                  <View style={themeStyles.colorGrid}>
                    <Pressable
                      key="auto"
                      style={[
                        themeStyles.colorChip,
                        reviewColor === null && themeStyles.colorChipActive,
                      ]}
                      onPress={() => {
                        hapticFeedback.light();
                        setReviewColor(null);
                      }}
                    >
                      <Text
                        style={[
                          themeStyles.colorChipText,
                          reviewColor === null && themeStyles.colorChipTextActive,
                        ]}
                      >
                        Auto
                      </Text>
                    </Pressable>
                    {COLORS.map((col) => {
                      const isActive = reviewColor === col;
                      return (
                        <Pressable
                          key={col}
                          style={[
                            themeStyles.colorChip,
                            isActive && themeStyles.colorChipActive,
                          ]}
                          onPress={() => {
                            hapticFeedback.light();
                            setReviewColor(col);
                          }}
                        >
                          <Text
                            style={[
                              themeStyles.colorChipText,
                              isActive && themeStyles.colorChipTextActive,
                            ]}
                          >
                            {col.charAt(0).toUpperCase() + col.slice(1)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={themeStyles.modalSection}>
                  <Text style={themeStyles.modalSectionTitle}>AI Metadata</Text>
                  <View style={themeStyles.metadataCard}>
                    {/* Type */}
                    <Text style={themeStyles.metadataLabel}>Type</Text>
                    <View style={themeStyles.tagChipsContainer}>
                      {META_TYPE_OPTIONS.map((opt) => {
                        const isActive =
                          (metaType ?? analysisResult.llm_metadata?.type) === opt;
                        return (
                          <Pressable
                            key={opt}
                            style={[
                              themeStyles.tagChipSelectable,
                              isActive && themeStyles.tagChipSelected,
                            ]}
                            onPress={() => setMetaType(opt)}
                          >
                            <Text
                              style={[
                                themeStyles.tagChipText,
                                isActive && themeStyles.tagChipTextSelected,
                              ]}
                            >
                              {opt}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Pattern */}
                    <Text style={themeStyles.metadataLabel}>Pattern</Text>
                    <View style={themeStyles.tagChipsContainer}>
                      {META_PATTERN_OPTIONS.map((opt) => {
                        const isActive =
                          (metaPattern ?? analysisResult.llm_metadata?.pattern) === opt;
                        return (
                          <Pressable
                            key={opt}
                            style={[
                              themeStyles.tagChipSelectable,
                              isActive && themeStyles.tagChipSelected,
                            ]}
                            onPress={() => setMetaPattern(opt)}
                          >
                            <Text
                              style={[
                                themeStyles.tagChipText,
                                isActive && themeStyles.tagChipTextSelected,
                              ]}
                            >
                              {opt}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Fit */}
                    <Text style={themeStyles.metadataLabel}>Fit</Text>
                    <View style={themeStyles.tagChipsContainer}>
                      {META_FIT_OPTIONS.map((opt) => {
                        const isActive =
                          (metaFit ?? analysisResult.llm_metadata?.fit) === opt;
                        return (
                          <Pressable
                            key={opt}
                            style={[
                              themeStyles.tagChipSelectable,
                              isActive && themeStyles.tagChipSelected,
                            ]}
                            onPress={() => setMetaFit(opt)}
                          >
                            <Text
                              style={[
                                themeStyles.tagChipText,
                                isActive && themeStyles.tagChipTextSelected,
                              ]}
                            >
                              {opt}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Detected color name */}
                    <Text style={themeStyles.metadataLabel}>Detected color</Text>
                    <View style={themeStyles.tagChipsContainer}>
                      {COLORS.map((opt) => {
                        const isActive =
                          (metaColorName ?? analysisResult.llm_metadata?.color_name) === opt;
                        return (
                          <Pressable
                            key={opt}
                            style={[
                              themeStyles.tagChipSelectable,
                              isActive && themeStyles.tagChipSelected,
                            ]}
                            onPress={() => setMetaColorName(opt)}
                          >
                            <Text
                              style={[
                                themeStyles.tagChipText,
                                isActive && themeStyles.tagChipTextSelected,
                              ]}
                            >
                              {opt}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Color tone */}
                    <Text style={themeStyles.metadataLabel}>Color tone</Text>
                    <View style={themeStyles.tagChipsContainer}>
                      {META_COLOR_TONE_OPTIONS.map((opt) => {
                        const isActive =
                          (metaColorTone ?? analysisResult.llm_metadata?.color_type) === opt;
                        return (
                          <Pressable
                            key={opt}
                            style={[
                              themeStyles.tagChipSelectable,
                              isActive && themeStyles.tagChipSelected,
                            ]}
                            onPress={() => setMetaColorTone(opt)}
                          >
                            <Text
                              style={[
                                themeStyles.tagChipText,
                                isActive && themeStyles.tagChipTextSelected,
                              ]}
                            >
                              {opt}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    {/* Fabric */}
                    <Text style={themeStyles.metadataLabel}>Fabric</Text>
                    <View style={themeStyles.tagChipsContainer}>
                      {META_FABRIC_OPTIONS.map((opt) => {
                        const isActive =
                          (metaFabric ?? analysisResult.llm_metadata?.fabric) === opt;
                        return (
                          <Pressable
                            key={opt}
                            style={[
                              themeStyles.tagChipSelectable,
                              isActive && themeStyles.tagChipSelected,
                            ]}
                            onPress={() => setMetaFabric(opt)}
                          >
                            <Text
                              style={[
                                themeStyles.tagChipText,
                                isActive && themeStyles.tagChipTextSelected,
                              ]}
                            >
                              {opt}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                </View>

                <View style={themeStyles.modalSection}>
                  <Text style={themeStyles.modalSectionTitle}>Style vibe</Text>
                  <View style={themeStyles.tagChipsContainer}>
                    {STYLE_VIBE_OPTIONS.map((vibe) => {
                      const isSelected = selectedStyleVibes.includes(vibe);
                      return (
                        <Pressable
                          key={vibe}
                          onPress={() => toggleStyleVibe(vibe)}
                          style={[
                            themeStyles.tagChipSelectable,
                            isSelected && themeStyles.tagChipSelected,
                          ]}
                        >
                          <Text
                            style={[
                              themeStyles.tagChipText,
                              isSelected && themeStyles.tagChipTextSelected,
                            ]}
                          >
                            {vibe}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={themeStyles.modalSection}>
                  <Text style={themeStyles.modalSectionTitle}>Notes (optional)</Text>
                  <TextInput
                    style={themeStyles.notesInput}
                    placeholder="Where would you wear this? Any fit notes?"
                    placeholderTextColor={theme.colors.textTertiary}
                    value={note}
                    onChangeText={setNote}
                    multiline
                  />
                </View>

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
                    <Text style={themeStyles.saveButtonText}>Save to closet</Text>
                  )}
                </Pressable>
              </>
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
    modalHeaderSpinner: {
      width: 64,
      alignItems: "flex-end",
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
    photoActions: {
      flexDirection: "row",
      justifyContent: "center",
      gap: theme.spacing.md,
      marginTop: theme.spacing.md,
    },
    secondaryPhotoButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    secondaryPhotoButtonText: {
      fontSize: theme.typography.sm,
      color: theme.colors.accent,
      fontWeight: theme.typography.medium,
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
    analysisState: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      marginBottom: theme.spacing.xl,
    },
    analysisTitle: {
      marginTop: theme.spacing.md,
      fontSize: theme.typography.lg,
      fontWeight: theme.typography.semibold,
      color: theme.colors.textPrimary,
    },
    analysisSubtitle: {
      marginTop: theme.spacing.sm,
      fontSize: theme.typography.sm,
      lineHeight: theme.typography.sm * theme.typography.lineHeight,
      color: theme.colors.textSecondary,
      textAlign: "center",
    },
    errorTitle: {
      marginTop: theme.spacing.md,
      fontSize: theme.typography.base,
      fontWeight: theme.typography.semibold,
      color: theme.colors.textPrimary,
      textAlign: "center",
    },
    errorSubtitle: {
      marginTop: theme.spacing.xs,
      fontSize: theme.typography.sm,
      color: theme.colors.textSecondary,
      textAlign: "center",
      lineHeight: theme.typography.sm * theme.typography.lineHeight,
    },
    retryButton: {
      marginTop: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.accent,
    },
    retryButtonText: {
      color: theme.colors.white,
      fontWeight: theme.typography.semibold,
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
    metadataCard: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    metadataRow: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    metadataLabel: {
      fontSize: theme.typography.sm,
      color: theme.colors.textSecondary,
    },
    metadataValue: {
      fontSize: theme.typography.sm,
      color: theme.colors.textPrimary,
      fontWeight: theme.typography.medium,
    },
    metadataStyleTags: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    tagChipsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    tagChip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.borderRadius.full,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tagChipText: {
      fontSize: theme.typography.xs,
      color: theme.colors.textSecondary,
    },
    tagChipSelectable: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundSecondary,
    },
    tagChipSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    tagChipTextSelected: {
      color: theme.colors.white,
    },
    emptyTagsText: {
      fontSize: theme.typography.sm,
      color: theme.colors.textSecondary,
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

