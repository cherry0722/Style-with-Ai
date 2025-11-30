import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCloset } from '../store/closet';
import { Garment, GarmentCategory, ColorName, FashionMetadata } from '../types';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../utils/haptics';
import {
  uploadWardrobeImage,
  createWardrobeItem,
  WardrobeItemResponse,
  analyzeWardrobeImage,
  WardrobeAnalyzeResponse,
} from '../api/wardrobe';
import { useAuth } from '../context/AuthContext';

const CATEGORIES: GarmentCategory[] = ["top", "bottom", "dress", "outerwear", "shoes", "accessory"];
const COLORS: ColorName[] = ["black", "white", "gray", "blue", "green", "red", "yellow", "beige", "brown", "pink", "purple"];

export default function OutfitScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { add } = useCloset();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [category, setCategory] = useState<GarmentCategory>("top");
  const [color, setColor] = useState<ColorName>("black");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isFinalSaving, setIsFinalSaving] = useState(false);

  const [analysis, setAnalysis] = useState<WardrobeAnalyzeResponse | null>(null);
  const [reviewCategory, setReviewCategory] = useState<string>("top");
  const [reviewType, setReviewType] = useState<string>("");
  const [reviewFabric, setReviewFabric] = useState<string>("unknown");
  const [reviewColorName, setReviewColorName] = useState<string>("");
  const [reviewColorType, setReviewColorType] = useState<string>("neutral");
  const [reviewPattern, setReviewPattern] = useState<string>("solid");
  const [reviewFit, setReviewFit] = useState<string>("unknown");
  const [reviewStyleTags, setReviewStyleTags] = useState<string>("");

  const styles = createStyles(theme);

  const handleAddFit = () => {
    hapticFeedback.light();
    setShowAddModal(true);
  };

  const handleImageSource = (source: 'camera' | 'gallery') => {
    hapticFeedback.selection();
    if (source === 'camera') {
      takePicture();
    } else {
      pickFromGallery();
    }
  };

  const takePicture = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
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
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take picture. Please try again.');
    }
  };

  const pickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library permission is needed to select images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const saveGarment = async () => {
    console.log("[OutfitScreen] analyze + preview called", {
      hasUser: !!user,
      userId: user?.id,
      selectedImage,
      category,
      color,
      notes: note,
    });

    if (!user) {
      Alert.alert(
        "Not logged in",
        "Please log in before adding outfits to your wardrobe."
      );
      console.log("[OutfitScreen] Aborting save: no user");
      return;
    }

    if (!selectedImage) {
      Alert.alert("No image", "Please take or select a photo first.");
      console.log("[OutfitScreen] Aborting analyze: no selectedImage");
      return;
    }

    try {
      setIsSaving(true);
      console.log("[OutfitScreen] Starting upload for", selectedImage);

      const imageUrl = await uploadWardrobeImage(selectedImage);
      console.log("[OutfitScreen] Upload complete, imageUrl =", imageUrl);

      console.log("[OutfitScreen] Calling analyzeWardrobeImage with:", {
        imageUrl,
        category,
        colors: [color],
        notes: note || "",
      });

      const analyzeResult = await analyzeWardrobeImage({
        imageUrl,
        category,
        colors: [color],
        notes: note || "",
      });

      console.log(
        "[OutfitScreen] analyzeWardrobeImage result:",
        analyzeResult
      );

      setAnalysis(analyzeResult);

      const m: FashionMetadata | null = analyzeResult.llm_metadata;

      setReviewCategory(m?.category || category || "top");
      setReviewType(m?.type || "");
      setReviewFabric(m?.fabric || "unknown");
      setReviewColorName(
        m?.color_name ||
          analyzeResult.color_hint ||
          (color ? String(color).toLowerCase() : "")
      );
      setReviewColorType(m?.color_type || "neutral");
      setReviewPattern(m?.pattern || "solid");
      setReviewFit(m?.fit || "unknown");
      setReviewStyleTags(
        Array.isArray(m?.style_tags) && m.style_tags.length > 0
          ? m.style_tags.join(", ")
          : ""
      );

      Alert.alert(
        "Review AI Tags",
        "We analyzed your item. Review and edit the fields below, then tap \"Save Item to Closet\"."
      );
    } catch (err: any) {
      console.error("[OutfitScreen] Failed to analyze outfit:", {
        message: err?.message,
        status: err?.status ?? err?.response?.status,
        data: err?.response?.data,
        fullError: err,
      });
      Alert.alert(
        "Error",
        err?.message || "Failed to analyze outfit. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalSave = async () => {
    if (!user) {
      Alert.alert(
        "Not logged in",
        "Please log in before adding outfits to your wardrobe."
      );
      return;
    }

    if (!analysis || !analysis.imageUrl) {
      Alert.alert(
        "Missing analysis",
        "Please analyze the image first before saving."
      );
      return;
    }

    try {
      setIsFinalSaving(true);

      const styleTagsArray = reviewStyleTags
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const azureTags = Array.isArray(analysis.azure_tags)
        ? analysis.azure_tags
        : [];

      const combinedTags = [...azureTags, ...styleTagsArray];
      const finalTagsArray = Array.from(
        new Set(
          combinedTags
            .map((t) => String(t).trim().toLowerCase())
            .filter((t) => t.length > 0)
        )
      ).slice(0, 20);

      const payload = {
        category: reviewCategory || category,
        colors: reviewColorName
          ? [reviewColorName]
          : color
          ? [color]
          : [],
        imageUrl: analysis.imageUrl,
        notes: note || undefined,
        type: reviewType || undefined,
        fabric: reviewFabric || undefined,
        color_name: reviewColorName || undefined,
        color_type: reviewColorType || undefined,
        pattern: reviewPattern || undefined,
        fit: reviewFit || undefined,
        style_tags: styleTagsArray.length > 0 ? styleTagsArray : undefined,
        tags: finalTagsArray,
      };

      console.log(
        "[OutfitScreen] Creating wardrobe item with reviewed payload:",
        payload
      );

      const created: WardrobeItemResponse = await createWardrobeItem(payload);

      console.log("[OutfitScreen] Wardrobe item created:", created);
      console.log("[OutfitScreen] Created item userId:", created.userId);
      console.log("[OutfitScreen] Created item _id:", created._id);

      const garment: Garment = {
        id: created._id,
        imageUrl: created.imageUrl,
        category: created.category as GarmentCategory,
        colors: (created.colors ?? []) as ColorName[],
        notes: created.notes,
      };

      add(garment);
      hapticFeedback.success();

      setSelectedImage(null);
      setCategory("top");
      setColor("black");
      setNote("");
      setAnalysis(null);
      setReviewCategory("top");
      setReviewType("");
      setReviewFabric("unknown");
      setReviewColorName("");
      setReviewColorType("neutral");
      setReviewPattern("solid");
      setReviewFit("unknown");
      setReviewStyleTags("");
      setShowAddModal(false);

      Alert.alert("Saved", "Item saved to your closet.");
    } catch (err: any) {
      console.error("[OutfitScreen] Failed to save reviewed outfit:", {
        message: err?.message,
        status: err?.status ?? err?.response?.status,
        data: err?.response?.data,
        fullError: err,
      });
      Alert.alert(
        "Error",
        err?.message || "Failed to save item. Please try again."
      );
    } finally {
      setIsFinalSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedImage(null);
    setCategory("top");
    setColor("black");
    setNote("");
    setAnalysis(null);
    setReviewCategory("top");
    setReviewType("");
    setReviewFabric("unknown");
    setReviewColorName("");
    setReviewColorType("neutral");
    setReviewPattern("solid");
    setReviewFit("unknown");
    setReviewStyleTags("");
    setShowAddModal(false);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Outfits</Text>
        <Pressable style={styles.addButton} onPress={handleAddFit}>
          <Ionicons name="add" size={24} color={theme.colors.white} />
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        <View style={styles.emptyState}>
          <Ionicons name="shirt-outline" size={64} color={theme.colors.textTertiary} />
          <Text style={styles.emptyTitle}>Start Building Your Style</Text>
          <Text style={styles.emptySubtitle}>
            Add your favorite outfits and create your personal style collection
          </Text>
          <Pressable style={styles.ctaButton} onPress={handleAddFit}>
            <Text style={styles.ctaButtonText}>Add Your First Outfit</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Add Outfit Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={resetForm}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={resetForm}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Add Outfit</Text>
            <Pressable
              onPress={saveGarment}
              disabled={!selectedImage || isSaving}
              style={{ opacity: !selectedImage || isSaving ? 0.6 : 1 }}
            >
              {isSaving ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color={theme.colors.accent} />
                  <Text style={styles.modalSave}>Analyzing...</Text>
                </View>
              ) : (
                <Text style={styles.modalSave}>Analyze</Text>
              )}
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Image Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Add Photo</Text>
              {selectedImage ? (
                <View style={styles.imageContainer}>
                  <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
                  <Pressable style={styles.changeImageButton} onPress={() => setSelectedImage(null)}>
                    <Ionicons name="close" size={20} color={theme.colors.white} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.imageSourceButtons}>
                  <Pressable
                    style={styles.sourceButton}
                    onPress={() => handleImageSource('camera')}
                  >
                    <Ionicons name="camera" size={24} color={theme.colors.accent} />
                    <Text style={styles.sourceButtonText}>Take Photo</Text>
                  </Pressable>
                  <Pressable
                    style={styles.sourceButton}
                    onPress={() => handleImageSource('gallery')}
                  >
                    <Ionicons name="images" size={24} color={theme.colors.accent} />
                    <Text style={styles.sourceButtonText}>Choose from Gallery</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Category Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Category</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat}
                    style={[
                      styles.categoryButton,
                      category === cat && styles.categoryButtonActive,
                    ]}
                    onPress={() => {
                      hapticFeedback.light();
                      setCategory(cat);
                    }}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        category === cat && styles.categoryButtonTextActive,
                      ]}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Color Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Primary Color</Text>
              <View style={styles.colorGrid}>
                {COLORS.map((col) => (
                  <Pressable
                    key={col}
                    style={[
                      styles.colorButton,
                      color === col && styles.colorButtonActive,
                    ]}
                    onPress={() => {
                      hapticFeedback.light();
                      setColor(col);
                    }}
                  >
                    <Text
                      style={[
                        styles.colorButtonText,
                        color === col && styles.colorButtonTextActive,
                      ]}
                    >
                      {col.charAt(0).toUpperCase() + col.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes (Optional)</Text>
              <View style={styles.notesContainer}>
                <TextInput
                  style={styles.notesInput}
                  placeholder="Add any notes about this outfit..."
                  placeholderTextColor={theme.colors.textTertiary}
                  value={note}
                  onChangeText={setNote}
                  multiline
                />
              </View>
            </View>

            {analysis && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Review AI Tags</Text>

                <View style={styles.reviewField}>
                  <Text style={styles.reviewLabel}>Category (top/bottom/shoes)</Text>
                  <TextInput
                    style={styles.reviewInput}
                    value={reviewCategory}
                    onChangeText={setReviewCategory}
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.reviewField}>
                  <Text style={styles.reviewLabel}>Type</Text>
                  <TextInput
                    style={styles.reviewInput}
                    value={reviewType}
                    onChangeText={setReviewType}
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.reviewField}>
                  <Text style={styles.reviewLabel}>Fabric</Text>
                  <TextInput
                    style={styles.reviewInput}
                    value={reviewFabric}
                    onChangeText={setReviewFabric}
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.reviewField}>
                  <Text style={styles.reviewLabel}>Color Name</Text>
                  <TextInput
                    style={styles.reviewInput}
                    value={reviewColorName}
                    onChangeText={setReviewColorName}
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.reviewField}>
                  <Text style={styles.reviewLabel}>Color Type (neutral/warm/cool/bold/pastel)</Text>
                  <TextInput
                    style={styles.reviewInput}
                    value={reviewColorType}
                    onChangeText={setReviewColorType}
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.reviewField}>
                  <Text style={styles.reviewLabel}>Pattern</Text>
                  <TextInput
                    style={styles.reviewInput}
                    value={reviewPattern}
                    onChangeText={setReviewPattern}
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.reviewField}>
                  <Text style={styles.reviewLabel}>Fit</Text>
                  <TextInput
                    style={styles.reviewInput}
                    value={reviewFit}
                    onChangeText={setReviewFit}
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.reviewField}>
                  <Text style={styles.reviewLabel}>Style Tags (comma-separated)</Text>
                  <TextInput
                    style={styles.reviewInput}
                    value={reviewStyleTags}
                    onChangeText={setReviewStyleTags}
                    autoCapitalize="none"
                    placeholder="e.g. casual, minimal, streetwear"
                    placeholderTextColor={theme.colors.textTertiary}
                  />
                </View>

                <Pressable
                  style={[
                    styles.ctaButton,
                    { marginTop: theme.spacing.lg },
                    isFinalSaving && { opacity: 0.6 },
                  ]}
                  onPress={handleFinalSave}
                  disabled={isFinalSaving}
                >
                  {isFinalSaving ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator size="small" color={theme.colors.white} />
                      <Text style={styles.ctaButtonText}>Saving...</Text>
                    </View>
                  ) : (
                    <Text style={styles.ctaButtonText}>Save Item to Closet</Text>
                  )}
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography['2xl'],
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
  },
  addButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.full,
    width: 40,
    height: 40,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingVertical: theme.spacing['4xl'],
  },
  emptyTitle: {
    fontSize: theme.typography.xl,
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  emptySubtitle: {
    fontSize: theme.typography.base,
    color: theme.colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: theme.typography.base * theme.typography.lineHeight,
    marginBottom: theme.spacing.xl,
  },
  ctaButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
  },
  ctaButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.base,
    fontWeight: theme.typography.bold,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
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
  modalSave: {
    fontSize: theme.typography.base,
    color: theme.colors.accent,
    fontWeight: theme.typography.bold,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.base,
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
  },
  imageContainer: {
    position: 'relative' as const,
    alignItems: 'center' as const,
  },
  selectedImage: {
    width: 200,
    height: 200,
    borderRadius: theme.borderRadius.lg,
  },
  changeImageButton: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    backgroundColor: theme.colors.error,
    borderRadius: theme.borderRadius.full,
    width: 32,
    height: 32,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  imageSourceButtons: {
    flexDirection: 'row' as const,
    gap: theme.spacing.md,
  },
  sourceButton: {
    flex: 1,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sourceButtonText: {
    fontSize: theme.typography.sm,
    fontWeight: theme.typography.medium,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.sm,
  },
  categoryGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  },
  categoryButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  categoryButtonActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  categoryButtonText: {
    fontSize: theme.typography.sm,
    fontWeight: theme.typography.medium,
    color: theme.colors.textSecondary,
  },
  categoryButtonTextActive: {
    color: theme.colors.white,
  },
  colorGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  },
  colorButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  colorButtonActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  colorButtonText: {
    fontSize: theme.typography.sm,
    fontWeight: theme.typography.medium,
    color: theme.colors.textSecondary,
  },
  colorButtonTextActive: {
    color: theme.colors.white,
  },
  notesContainer: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 100,
  },
  notesPlaceholder: {
    fontSize: theme.typography.base,
    color: theme.colors.textTertiary,
  },
});
