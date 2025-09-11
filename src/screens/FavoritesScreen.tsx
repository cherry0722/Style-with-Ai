import React from "react";
import { View, Text, FlatList, Image } from "react-native";
import { useFavorites } from "../store/favorites";

export default function FavoritesScreen() {
  const { items } = useFavorites();

  if (items.length === 0) {
    return (
      <View style={{ flex: 1, padding: 16, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#666" }}>No favorites yet. Tap the ♥ on an outfit to save it.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <FlatList
        data={items}
        keyExtractor={(o) => o.id}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => (
          <View style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 16, overflow: "hidden" }}>
            <View style={{ flexDirection: "row", padding: 10, gap: 10, alignItems: "center" }}>
              {item.items.map((it) => (
                <Image key={it.id} source={{ uri: it.uri }} style={{ width: 70, height: 70, borderRadius: 8 }} />
              ))}
            </View>
            <View style={{ padding: 10, gap: 6 }}>
              <Text style={{ fontWeight: "800" }}>Score: {item.score.toFixed(2)}</Text>
              <Text style={{ color: "#666" }}>Context: {item.context}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

