import React, { useState } from "react";
import { View, Text, Pressable, Image, TextInput, ActivityIndicator, Alert, StyleSheet } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { GarmentCategory } from "../types";
import { uploadWardrobeImage, createWardrobeItem } from "../api/wardrobe";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { hapticFeedback } from "../utils/haptics";

const CATS: GarmentCategory[] = ["top", "bottom", "dress", "outerwear", "shoes", "accessory"];

function Chip({ label, active, onPress, theme }: { label: string; active?: boolean; onPress?: () => void; theme: any }) {
  const styles = createStyles(theme);
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function ScanScreen() {
  const { user } = useAuth();
  const theme = useTheme();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [category, setCategory] = useState<GarmentCategory>("top");
  const [notes, setNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const styles = createStyles(theme);

  async function pickImage() {
    hapticFeedback.light();
    const res = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      quality: 0.7 
    });
    if (!res.canceled) setImageUri(res.assets[0].uri);
  }

  const handleSave = async () => {
    console.log("[ScanScreen] handleSave called", {
      hasUser: !!user,
      userId: user?.id,
      imageUri,
      category,
      notes,
    });

    if (!user) {
      Alert.alert(
        "Not logged in",
        "Please log in before adding items to your wardrobe."
      );
      console.log("[ScanScreen] Aborting save: no user");
      return;
    }

    if (!imageUri) {
      Alert.alert("No image", "Please select or capture an image first.");
      console.log("[ScanScreen] Aborting save: no imageUri");
      return;
    }

    try {
      setIsSaving(true);
      console.log("[ScanScreen] Starting upload for", imageUri);

      const { imageUrl, cleanImageUrl } = await uploadWardrobeImage(imageUri);
      console.log("[ScanScreen] Upload complete, imageUrl =", imageUrl, "cleanImageUrl =", cleanImageUrl);

      const payload = {
        imageUrl,
        cleanImageUrl,
        category,
        colors: [],
        notes: notes || undefined,
      };
      console.log("[ScanScreen] Creating wardrobe item with payload:", payload);

      const created = await createWardrobeItem(payload);

      console.log("[ScanScreen] Wardrobe item created:", created);
      console.log("[ScanScreen] Created item userId:", created.userId);
      console.log("[ScanScreen] Created item _id:", created._id);
      Alert.alert("Saved", "Item saved to your wardrobe (backend).");
    } catch (err: any) {
      console.error("[ScanScreen] Failed to save garment:", {
        message: err?.message,
        status: err?.status ?? err?.response?.status,
        data: err?.response?.data,
        fullError: err,
      });
      Alert.alert(
        "Error",
        err?.message || "Failed to save garment. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={pickImage} style={styles.btnHollow}>
        <Text style={styles.btnHollowText}>
          {imageUri ? "Change photo" : "Pick photo"}
        </Text>
      </Pressable>
      {imageUri && (
        <Image 
          source={{ uri: imageUri }} 
          style={styles.image}
        />
      )}

      <Text style={styles.label}>Category</Text>
      <View style={styles.chipContainer}>
        {CATS.map((c) => (
          <Chip 
            key={c} 
            label={c} 
            active={c === category} 
            onPress={() => {
              hapticFeedback.light();
              setCategory(c);
            }}
            theme={theme}
          />
        ))}
      </View>

      <TextInput 
        placeholder="Notes (brand, fit, etc.)" 
        placeholderTextColor={theme.colors.textTertiary}
        value={notes} 
        onChangeText={setNotes} 
        style={styles.input} 
      />

      <Pressable 
        disabled={!imageUri || isSaving} 
        onPress={handleSave} 
        style={({ pressed }) => [
          styles.btn, 
          { opacity: !imageUri || pressed || isSaving ? 0.6 : 1 }
        ]}
      >
        {isSaving ? (
          <View style={styles.buttonContent}>
            <ActivityIndicator color={theme.colors.white} size="small" />
            <Text style={styles.btnText}>Saving...</Text>
          </View>
        ) : (
          <Text style={styles.btnText}>Save</Text>
        )}
      </Pressable>

      <Text style={styles.helperText}>
        *For MVP we pick an image and annotate category manually. Later you can auto-detect via on-device model.
      </Text>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      backgroundColor: theme.colors.background,
    },
    btnHollow: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      alignItems: "center",
      backgroundColor: theme.colors.backgroundSecondary,
    },
    btnHollowText: {
      fontWeight: theme.typography.semibold,
      color: theme.colors.textPrimary,
      fontSize: theme.typography.base,
    },
    image: {
      width: "100%",
      height: 280,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.backgroundSecondary,
    },
    label: {
      fontWeight: theme.typography.bold,
      fontSize: theme.typography.base,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    chipContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
    },
    chip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 999,
      backgroundColor: theme.colors.backgroundSecondary,
    },
    chipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    chipText: {
      fontWeight: theme.typography.medium,
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sm,
    },
    chipTextActive: {
      color: theme.colors.white,
      fontWeight: theme.typography.bold,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.backgroundSecondary,
      color: theme.colors.textPrimary,
      fontSize: theme.typography.base,
    },
    btn: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      alignItems: "center",
      minHeight: 52,
    },
    buttonContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    btnText: {
      color: theme.colors.white,
      fontWeight: theme.typography.bold,
      fontSize: theme.typography.base,
    },
    helperText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.xs,
      lineHeight: theme.typography.xs * theme.typography.lineHeight,
    },
  });
