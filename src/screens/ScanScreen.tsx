import React, { useState } from "react";
import { View, Text, Pressable, Image, TextInput } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useCloset } from "../store/closet";
import { Garment, GarmentCategory, ColorName } from "../types";

const CATS: GarmentCategory[] = ["top", "bottom", "dress", "outerwear", "shoes", "accessory"];
const COLORS: ColorName[] = ["black", "white", "gray", "blue", "green", "red", "yellow", "beige", "brown", "pink", "purple"];

export default function ScanScreen() {
  const { add } = useCloset();
  const [uri, setUri] = useState<string | null>(null);
  const [category, setCategory] = useState<GarmentCategory>("top");
  const [color, setColor] = useState<ColorName>("black");
  const [note, setNote] = useState("");

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!res.canceled) setUri(res.assets[0].uri);
  }

  async function addGarment() {
    if (!uri) return;
    const g: Garment = {
      id: `${Date.now()}`,
      uri,
      category,
      colors: [color],
      notes: note || undefined,
    };
    add(g);
    setUri(null);
    setNote("");
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Pressable onPress={pickImage} style={styles.btnHollow}><Text style={styles.btnHollowText}>{uri ? "Change photo" : "Pick photo"}</Text></Pressable>
      {uri && <Image source={{ uri }} style={{ width: "100%", height: 280, borderRadius: 12 }} />}

      <Text style={styles.label}>Category</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {CATS.map((c) => (
          <Chip key={c} label={c} active={c === category} onPress={() => setCategory(c)} />
        ))}
      </View>

      <Text style={styles.label}>Dominant Color</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {COLORS.map((c) => (
          <Chip key={c} label={c} active={c === color} onPress={() => setColor(c)} />
        ))}
      </View>

      <TextInput placeholder="Notes (brand, fit, etc.)" value={note} onChangeText={setNote} style={styles.input} />

      <Pressable disabled={!uri} onPress={addGarment} style={({ pressed }) => [styles.btn, { opacity: !uri || pressed ? 0.6 : 1 }]}>
        <Text style={styles.btnText}>Add to Closet</Text>
      </Pressable>

      <Text style={{ color: "#777", fontSize: 12 }}>
        *For MVP we pick an image and annotate category/color manually. Later you can auto-detect via on-device model.
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
  btnText: { color: "#fff", fontWeight: "700" },
  btnHollow: { borderWidth: 1, borderColor: "#111", borderRadius: 12, padding: 12, alignItems: "center" as const },
  btnHollowText: { fontWeight: "700" },
  label: { fontWeight: "700" as const },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#ddd", borderRadius: 999 },
  chipActive: { backgroundColor: "#111", borderColor: "#111" },
  chipText: { fontWeight: "600" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
};