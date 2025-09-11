import React, { useMemo, useState } from "react";
import { View, Text, FlatList, Image, Pressable } from "react-native";
import { recommend } from "../services/recommender";
import { useCloset } from "../store/closet";
import { OutfitSuggestion } from "../types";

export default function OutfitIdeasScreen() {
  const { items } = useCloset();
  const [context, setContext] = useState<"date-night" | "casual" | "formal" | "work" | "party">("date-night");

  const ideas: OutfitSuggestion[] = useMemo(() => recommend(items, context, 5), [items, context]);

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>Top picks for {context.replace("-", " ")}</Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {["date-night", "casual", "formal", "work", "party"].map((c) => (
          <Pressable key={c} onPress={() => setContext(c as any)} style={[chipStyles.chip, context === c && chipStyles.chipActive]}>
            <Text style={[chipStyles.text, context === c && chipStyles.textActive]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      {ideas.length === 0 ? (
        <Text style={{ color: "#666" }}>Not enough items in your closet for this context yet.</Text>
      ) : (
        <FlatList
          data={ideas}
          keyExtractor={(o) => o.id}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => <OutfitCard suggestion={item} />}
        />
      )}
    </View>
  );
}

function OutfitCard({ suggestion }: { suggestion: OutfitSuggestion }) {
  return (
    <View style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 16, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", padding: 10, gap: 10, alignItems: "center" }}>
        {suggestion.items.map((it) => (
          <Image key={it.id} source={{ uri: it.uri }} style={{ width: 70, height: 70, borderRadius: 8 }} />
        ))}
      </View>
      <View style={{ padding: 10, gap: 6 }}>
        <Text style={{ fontWeight: "800" }}>Score: {suggestion.score.toFixed(2)}</Text>
        <Text style={{ color: "#666" }}>Context: {suggestion.context}</Text>
      </View>
    </View>
  );
}

const chipStyles = {
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#ddd", borderRadius: 999 },
  chipActive: { backgroundColor: "#111", borderColor: "#111" },
  text: { fontWeight: "600" },
  textActive: { color: "#fff", fontWeight: "700" },
};