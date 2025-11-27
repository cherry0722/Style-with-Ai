import React, { useState } from "react";
import { View, Text, Pressable, Image, TextInput, ActivityIndicator, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { GarmentCategory } from "../types";
import { uploadWardrobeImage, createWardrobeItem } from "../api/wardrobe";
import { useAuth } from "../context/AuthContext";

const CATS: GarmentCategory[] = ["top", "bottom", "dress", "outerwear", "shoes", "accessory"];

export default function ScanScreen() {
  const { user } = useAuth();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [category, setCategory] = useState<GarmentCategory>("top");
  const [notes, setNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  async function pickImage() {
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

      const imageUrl = await uploadWardrobeImage(imageUri);
      console.log("[ScanScreen] Upload complete, imageUrl =", imageUrl);

      const payload = {
        imageUrl,
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
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Pressable onPress={pickImage} style={styles.btnHollow}>
        <Text style={styles.btnHollowText}>
          {imageUri ? "Change photo" : "Pick photo"}
        </Text>
      </Pressable>
      {imageUri && (
        <Image 
          source={{ uri: imageUri }} 
          style={{ width: "100%", height: 280, borderRadius: 12 }} 
        />
      )}

      <Text style={styles.label}>Category</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {CATS.map((c) => (
          <Chip 
            key={c} 
            label={c} 
            active={c === category} 
            onPress={() => setCategory(c)} 
          />
        ))}
      </View>

      <TextInput 
        placeholder="Notes (brand, fit, etc.)" 
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.btnText}>Saving...</Text>
          </View>
        ) : (
          <Text style={styles.btnText}>Save</Text>
        )}
      </Pressable>

      <Text style={{ color: "#777", fontSize: 12 }}>
        *For MVP we pick an image and annotate category manually. Later you can auto-detect via on-device model.
      </Text>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = {
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 10 },
  btn: { backgroundColor: "#111", borderRadius: 12, padding: 14, alignItems: "center" as const },
  btnText: { color: "#fff", fontWeight: "700" as const },
  btnHollow: { borderWidth: 1, borderColor: "#111", borderRadius: 12, padding: 12, alignItems: "center" as const },
  btnHollowText: { fontWeight: "700" as const },
  label: { fontWeight: "700" as const },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#ddd", borderRadius: 999 },
  chipActive: { backgroundColor: "#111", borderColor: "#111" },
  chipText: { fontWeight: "600" as const },
  chipTextActive: { color: "#fff", fontWeight: "700" as const },
};