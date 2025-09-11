import React from "react";
import { View, Image, Text, Pressable } from "react-native";
import { Garment } from "../types";

export default function ClothingCard({ item, onDelete }: { item: Garment; onDelete?: (id: string) => void }) {
  return (
    <View style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 16, overflow: "hidden" }}>
      <Image source={{ uri: item.uri }} style={{ width: "100%", height: 160 }} />
      <View style={{ padding: 10, gap: 4 }}>
        <Text style={{ fontWeight: "700" }}>{item.category.toUpperCase()}</Text>
        <Text style={{ color: "#555" }}>Colors: {item.colors.join(", ")}</Text>
        {onDelete && (
          <Pressable onPress={() => onDelete(item.id)} style={{ padding: 8, backgroundColor: "#f33", borderRadius: 10, alignSelf: "flex-start" }}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>Delete</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
