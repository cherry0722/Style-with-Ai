import React from "react";
import { View, FlatList, Text } from "react-native";
import ClothingCard from "../components/ClothingCard";
import { useCloset } from "../store/closet";

export default function ClosetScreen() {
  const { items, remove } = useCloset();

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {items.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
          <Text style={{ textAlign: "center", fontSize: 16, color: "#666" }}>
            Your closet is empty. Use the Scan tab to add garments.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={({ item }) => <ClothingCard item={item} onDelete={remove} />}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </View>
  );
}
