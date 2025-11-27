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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCloset } from '../store/closet';
import { Garment, GarmentCategory, ColorName } from '../types';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../utils/haptics';
import { uploadWardrobeImage, createWardrobeItem, WardrobeItemResponse } from '../api/wardrobe';
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
    console.log("[OutfitScreen] saveOutfit called", {
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
      console.log("[OutfitScreen] Aborting save: no selectedImage");
      return;
    }

    try {
      setIsSaving(true);
      console.log("[OutfitScreen] Starting upload for", selectedImage);

      const imageUrl = await uploadWardrobeImage(selectedImage);
      console.log("[OutfitScreen] Upload complete, imageUrl =", imageUrl);

      const payload = {
        imageUrl,
        category,
        colors: [color],
        notes: note || undefined,
      };
      console.log("[OutfitScreen] Creating wardrobe item with payload:", payload);

      const created: WardrobeItemResponse = await createWardrobeItem(payload);

      console.log("[OutfitScreen] Wardrobe item created:", created);
      console.log("[OutfitScreen] Created item userId:", created.userId);
      console.log("[OutfitScreen] Created item _id:", created._id);

      // Map backend response to Garment and add to store
      const garment: Garment = {
        id: created._id,
        imageUrl: created.imageUrl,
        category: created.category as GarmentCategory,
        colors: (created.colors ?? []) as ColorName[],
        notes: created.notes,
        // Do NOT set uri for backend items
      };

      add(garment);
      hapticFeedback.success();

      // Reset form
      setSelectedImage(null);
      setCategory("top");
      setColor("black");
      setNote("");
      setShowAddModal(false);

      Alert.alert("Saved", "Outfit saved to your wardrobe.");
    } catch (err: any) {
      console.error("[OutfitScreen] Failed to save outfit:", {
        message: err?.message,
        status: err?.status ?? err?.response?.status,
        data: err?.response?.data,
        fullError: err,
      });
      Alert.alert(
        "Error",
        err?.message || "Failed to save outfit. Please try again."
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
                  <Text style={styles.modalSave}>Saving...</Text>
                </View>
              ) : (
                <Text style={styles.modalSave}>Save</Text>
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
                <Text style={styles.notesPlaceholder}>
                  Add any notes about this outfit...
                </Text>
              </View>
            </View>
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
