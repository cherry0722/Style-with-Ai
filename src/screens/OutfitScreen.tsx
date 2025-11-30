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

// Dropdown options
const TYPE_OPTIONS = ["t-shirt","shirt","flannel","hoodie","sweater","sweatshirt","polo","jacket","overshirt","denim jacket","puffer","jeans","chinos","trousers","joggers","shorts","cargo pants","sweatpants","sneakers","boots","loafers","oxfords","derbies","sandals","slides","chelseas"];
const COLOR_NAME_OPTIONS = ["black", "white", "grey", "blue", "green", "red", "beige", "brown", "navy", "olive", "cream"];
const COLOR_TYPE_OPTIONS: ("neutral" | "warm" | "cool" | "bold" | "pastel")[] = ["neutral", "warm", "cool", "bold", "pastel"];
const PATTERN_OPTIONS = ["solid", "striped", "checked", "plaid", "floral", "graphic", "colorblock", "textured", "distressed", "embroidered", "cargo-pockets", "unknown"];
const FIT_OPTIONS = ["slim", "regular", "relaxed", "oversized", "tapered", "skinny", "wide", "unknown"];
const STYLE_TAG_OPTIONS = ["minimal","streetwear","sporty","classy","formal","casual","retro","edgy","cozy","monochrome","premium","workwear","vintage","smart-casual"];
const METADATA_CATEGORY_OPTIONS: ("top" | "bottom" | "shoes")[] = ["top", "bottom", "shoes"];

// Simple Dropdown Component
function Dropdown<T extends string>({
  value,
  options,
  onSelect,
  placeholder,
  style,
}: {
  value: T | undefined;
  options: readonly T[];
  onSelect: (val: T) => void;
  placeholder?: string;
  style?: any;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useTheme();

  return (
    <View>
      <Pressable
        style={[
          {
            backgroundColor: theme.colors.backgroundSecondary,
            borderRadius: theme.borderRadius.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          },
          style,
        ]}
        onPress={() => setIsOpen(!isOpen)}
      >
        <Text style={{ color: value ? theme.colors.textPrimary : theme.colors.textTertiary }}>
          {value || placeholder || 'Select...'}
        </Text>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.colors.textSecondary}
        />
      </Pressable>
      {isOpen && (
        <View
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 1000,
            backgroundColor: theme.colors.background,
            borderRadius: theme.borderRadius.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
            marginTop: 4,
            maxHeight: 200,
          }}
        >
          <ScrollView>
            {options.map((opt) => (
              <Pressable
                key={opt}
                style={{
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                }}
                onPress={() => {
                  onSelect(opt);
                  setIsOpen(false);
                  hapticFeedback.light();
                }}
              >
                <Text style={{ color: theme.colors.textPrimary }}>{opt}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function OutfitScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const { add } = useCloset();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [category, setCategory] = useState<GarmentCategory>("top");
  const [color, setColor] = useState<ColorName>("black");
  const [note, setNote] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Analysis and draft metadata state
  const [analysisResult, setAnalysisResult] = useState<WardrobeAnalyzeResponse | null>(null);
  const [draftMetadata, setDraftMetadata] = useState<FashionMetadata | null>(null);
  const [cleanImageUrl, setCleanImageUrl] = useState<string | undefined>(undefined);

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

  const handleAnalyze = async () => {
    console.log("[OutfitScreen] Starting analyze flow", {
      hasUser: !!user,
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
      return;
    }

    if (!selectedImage) {
      Alert.alert("No image", "Please take or select a photo first.");
      return;
    }

    try {
      setIsAnalyzing(true);
      console.log("[OutfitScreen] Step A: Uploading image", selectedImage);

      // Step A: Upload image
      const { imageUrl, cleanImageUrl: uploadedCleanImageUrl } = await uploadWardrobeImage(selectedImage);
      console.log("[OutfitScreen] Upload complete, imageUrl =", imageUrl, "cleanImageUrl =", uploadedCleanImageUrl);
      setCleanImageUrl(uploadedCleanImageUrl);

      // Step B: Analyze image
      console.log("[OutfitScreen] Step B: Analyzing image", {
        imageUrl,
        category,
        colors: color ? [color] : [],
        notes: note || "",
      });

      const result = await analyzeWardrobeImage({
        imageUrl,
        category,
        colors: color ? [color] : [],
        notes: note || "",
      });

      console.log("[OutfitScreen] Analysis result:", result);

      // Step C: Store results
      setAnalysisResult(result);
      
      const initialMetadata: FashionMetadata = {
        category: (result.llm_metadata?.category as "top" | "bottom" | "shoes" | undefined) || 
                  (result.category_hint as "top" | "bottom" | "shoes" | undefined) || 
                  "top",
        type: result.llm_metadata?.type,
        fabric: result.llm_metadata?.fabric,
        color_name: result.llm_metadata?.color_name || result.color_hint || undefined,
        color_type: result.llm_metadata?.color_type,
        pattern: result.llm_metadata?.pattern,
        fit: result.llm_metadata?.fit,
        style_tags: result.llm_metadata?.style_tags,
      };
      
      setDraftMetadata(initialMetadata);
      
      console.log("[OutfitScreen] Draft metadata initialized:", initialMetadata);
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
      setIsAnalyzing(false);
    }
  };

  const handleSaveWithMetadata = async () => {
    if (!user) {
      Alert.alert(
        "Not logged in",
        "Please log in before adding outfits to your wardrobe."
      );
      return;
    }

    if (!analysisResult || !analysisResult.imageUrl) {
      Alert.alert(
        "Missing analysis",
        "Please analyze the image first before saving."
      );
      return;
    }

    try {
      setIsSaving(true);

      // Build tags array from draftMetadata
      const tags: string[] = [];
      if (draftMetadata?.type) tags.push(draftMetadata.type);
      if (draftMetadata?.pattern) tags.push(draftMetadata.pattern);
      if (draftMetadata?.fabric) tags.push(draftMetadata.fabric);
      if (draftMetadata?.style_tags?.length) {
        tags.push(...draftMetadata.style_tags);
      }

      console.log("[OutfitScreen] Saving with metadata:", {
        imageUrl: analysisResult.imageUrl,
        category: draftMetadata?.category ?? category,
        colors: color ? [color] : [],
        notes: note,
        metadata: draftMetadata,
        tags,
      });

      const created: WardrobeItemResponse = await createWardrobeItem({
        imageUrl: analysisResult.imageUrl,
        cleanImageUrl: cleanImageUrl,
        category: (draftMetadata?.category ?? category) as string,
        colors: color ? [color] : [],
        notes: note || undefined,
        metadata: draftMetadata ?? undefined,
        tags,
      });

      console.log("[OutfitScreen] Wardrobe item created:", created);

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

      // Reset state
      resetForm();
      Alert.alert("Saved", "Item saved to your closet.");
    } catch (err: any) {
      console.error("[OutfitScreen] Failed to save item:", {
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
      setIsSaving(false);
    }
  };

  const handleSkipAndSave = async () => {
    if (!user) {
      Alert.alert(
        "Not logged in",
        "Please log in before adding outfits to your wardrobe."
      );
      return;
    }

    if (!analysisResult || !analysisResult.imageUrl) {
      Alert.alert(
        "Missing analysis",
        "Please analyze the image first before saving."
      );
      return;
    }

    try {
      setIsSaving(true);

      console.log("[OutfitScreen] Skipping AI and saving without metadata:", {
        imageUrl: analysisResult.imageUrl,
        category,
        colors: color ? [color] : [],
        notes: note,
      });

      const created: WardrobeItemResponse = await createWardrobeItem({
        imageUrl: analysisResult.imageUrl,
        cleanImageUrl: cleanImageUrl,
        category,
        colors: color ? [color] : [],
        notes: note || undefined,
      });

      console.log("[OutfitScreen] Wardrobe item created:", created);

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

      // Reset state
      resetForm();
      Alert.alert("Saved", "Item saved to your closet.");
    } catch (err: any) {
      console.error("[OutfitScreen] Failed to save item:", {
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
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedImage(null);
    setCategory("top");
    setColor("black");
    setNote("");
    setAnalysisResult(null);
    setDraftMetadata(null);
    setCleanImageUrl(undefined);
    setShowAddModal(false);
  };

  const updateDraftMetadata = (updates: Partial<FashionMetadata>) => {
    setDraftMetadata((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  const toggleStyleTag = (tag: string) => {
    setDraftMetadata((prev) => {
      const currentTags = prev?.style_tags || [];
      const newTags = currentTags.includes(tag)
        ? currentTags.filter((t) => t !== tag)
        : [...currentTags, tag];
      return {
        ...prev,
        style_tags: newTags,
        category: prev?.category || "top",
      };
    });
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
              onPress={handleAnalyze}
              disabled={!selectedImage || isAnalyzing}
              style={{ opacity: !selectedImage || isAnalyzing ? 0.6 : 1 }}
            >
              {isAnalyzing ? (
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

            {/* Review Tags Panel */}
            {analysisResult && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Review Tags</Text>

                {/* Azure Tags - Read-only chips */}
                {analysisResult.azure_tags && analysisResult.azure_tags.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.reviewLabel}>Azure Vision Tags</Text>
                    <View style={styles.tagChipsContainer}>
                      {analysisResult.azure_tags.map((tag, idx) => (
                        <View key={idx} style={styles.tagChip}>
                          <Text style={styles.tagChipText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Metadata Fields */}
                <View style={styles.reviewField}>
                  <Text style={styles.reviewLabel}>Category</Text>
                  <Dropdown
                    value={draftMetadata?.category}
                    options={METADATA_CATEGORY_OPTIONS}
                    onSelect={(val) => updateDraftMetadata({ category: val })}
                    placeholder="Select category"
                  />
                </View>

                <View style={styles.reviewField}>
                  <Text style={styles.reviewLabel}>Type</Text>
                  <Dropdown
                    value={draftMetadata?.type}
                    options={TYPE_OPTIONS}
                    onSelect={(val) => updateDraftMetadata({ type: val })}
                    placeholder="Select type"
                  />
                </View>

                <View style={styles.reviewField}>
                  <Text style={styles.reviewLabel}>Fabric</Text>
                  <TextInput
                    style={styles.reviewInput}
                    value={draftMetadata?.fabric || ''}
                    onChangeText={(val) => updateDraftMetadata({ fabric: val || undefined })}
                    placeholder="e.g. cotton, wool, polyester"
                    placeholderTextColor={theme.colors.textTertiary}
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.reviewField}>
                  <Text style={styles.reviewLabel}>Color Name</Text>
                  <Dropdown
                    value={draftMetadata?.color_name}
                    options={COLOR_NAME_OPTIONS}
                    onSelect={(val) => updateDraftMetadata({ color_name: val })}
                    placeholder="Select color"
                  />
                </View>

                <View style={styles.reviewField}>
                  <Text style={styles.reviewLabel}>Color Type</Text>
                  <Dropdown
                    value={draftMetadata?.color_type}
                    options={COLOR_TYPE_OPTIONS}
                    onSelect={(val) => updateDraftMetadata({ color_type: val })}
                    placeholder="Select color type"
                  />
                </View>

                <View style={styles.reviewField}>
                  <Text style={styles.reviewLabel}>Pattern</Text>
                  <Dropdown
                    value={draftMetadata?.pattern}
                    options={PATTERN_OPTIONS}
                    onSelect={(val) => updateDraftMetadata({ pattern: val })}
                    placeholder="Select pattern"
                  />
                </View>

                <View style={styles.reviewField}>
                  <Text style={styles.reviewLabel}>Fit</Text>
                  <Dropdown
                    value={draftMetadata?.fit}
                    options={FIT_OPTIONS}
                    onSelect={(val) => updateDraftMetadata({ fit: val })}
                    placeholder="Select fit"
                  />
                </View>

                <View style={styles.reviewField}>
                  <Text style={styles.reviewLabel}>Style Tags</Text>
                  <View style={styles.tagChipsContainer}>
                    {STYLE_TAG_OPTIONS.map((tag) => {
                      const isSelected = draftMetadata?.style_tags?.includes(tag) || false;
                      return (
                        <Pressable
                          key={tag}
                          style={[
                            styles.tagChip,
                            isSelected && styles.tagChipSelected,
                          ]}
                          onPress={() => toggleStyleTag(tag)}
                        >
                          <Text
                            style={[
                              styles.tagChipText,
                              isSelected && styles.tagChipTextSelected,
                            ]}
                          >
                            {tag}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Save Buttons */}
                <Pressable
                  style={[
                    styles.ctaButton,
                    { marginTop: theme.spacing.lg, marginBottom: theme.spacing.md },
                    isSaving && { opacity: 0.6 },
                  ]}
                  onPress={handleSaveWithMetadata}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator size="small" color={theme.colors.white} />
                      <Text style={styles.ctaButtonText}>Saving...</Text>
                    </View>
                  ) : (
                    <Text style={styles.ctaButtonText}>Looks good, save item</Text>
                  )}
                </Pressable>

                <Pressable
                  style={[
                    styles.secondaryButton,
                    isSaving && { opacity: 0.6 },
                  ]}
                  onPress={handleSkipAndSave}
                  disabled={isSaving}
                >
                  <Text style={styles.secondaryButtonText}>Skip AI & save anyway</Text>
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
    alignItems: 'center' as const,
  },
  ctaButtonText: {
    color: theme.colors.white,
    fontSize: theme.typography.base,
    fontWeight: theme.typography.bold,
  },
  secondaryButton: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.base,
    fontWeight: theme.typography.medium,
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
  notesInput: {
    fontSize: theme.typography.base,
    color: theme.colors.textPrimary,
  },
  reviewField: {
    marginBottom: theme.spacing.md,
  },
  reviewLabel: {
    fontSize: theme.typography.sm,
    fontWeight: theme.typography.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  reviewInput: {
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.base,
    color: theme.colors.textPrimary,
  },
  tagChipsContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: theme.spacing.sm,
  },
  tagChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tagChipSelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  tagChipText: {
    fontSize: theme.typography.sm,
    color: theme.colors.textSecondary,
  },
  tagChipTextSelected: {
    color: theme.colors.white,
    fontWeight: theme.typography.medium,
  },
});
