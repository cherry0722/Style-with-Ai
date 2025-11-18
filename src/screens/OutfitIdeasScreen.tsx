import React, { useState, useEffect } from "react";
import { View, Text, FlatList, Image, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { recommend } from "../services/recommender";
import client from "../api/client";
import { useCloset } from "../store/closet";
import { OutfitSuggestion } from "../types";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

export default function OutfitIdeasScreen() {
  const theme = useTheme();
  const { items } = useCloset();
  const { user } = useAuth();
  const [context, setContext] = useState<"date-night" | "casual" | "formal" | "work" | "party">("date-night");
  const [ideas, setIdeas] = useState<OutfitSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiOutfit, setAiOutfit] = useState<OutfitSuggestion | null>(null);

  // Load initial ideas on mount or context change
  useEffect(() => {
    const loadIdeas = async () => {
      try {
        const result = await recommend(items, context, user?.id, 5);
        setIdeas(result);
        console.log("[OutfitIdeasScreen] Loaded ideas:", result.length);
      } catch (error) {
        console.error("[OutfitIdeasScreen] Error loading ideas:", error);
        setIdeas([]);
      }
    };
    loadIdeas();
  }, [items, context, user?.id]);

  const handleGenerateOutfit = async () => {
    try {
      setLoading(true);
      console.log("[OutfitIdeasScreen] AI outfit generation started...");
      const result = await recommend(items, context, user?.id, 1);
      console.log("[OutfitIdeasScreen] AI Response:", result);
      if (result && result.length > 0) {
        setAiOutfit(result[0]);
        Alert.alert("✨ AI Outfit Generated!", `Got ${result[0].items.length} items from AI backend`);
      } else {
        Alert.alert("No items", "Backend returned no outfit suggestions");
      }
    } catch (err) {
      console.error("[OutfitIdeasScreen] AI outfit generation failed:", err);
      Alert.alert("Error", "Failed to generate outfit. Ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(theme);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Top picks for {context.replace("-", " ")}</Text>

      {/* AI Generation Button */}
      <Pressable 
        style={[styles.aiButton, loading && styles.aiButtonDisabled]} 
        onPress={handleGenerateOutfit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.white} />
        ) : (
          <Text style={styles.aiButtonText}>✨ Generate with AI</Text>
        )}
      </Pressable>

      {/* AI Generated Outfit Display */}
      {aiOutfit && (
        <View style={styles.aiResultCard}>
          <Text style={styles.aiResultTitle}>🤖 AI Suggestion:</Text>

          {/* Items row: thumbnail + name (resolve by id from closet) */}
          <View style={styles.aiItemsRow}>
            {(aiOutfit.items || []).map((it: any, idx: number) => {
              // items may be IDs (string) or Garment objects
              const id = typeof it === 'string' ? it : (it && it.id) ? it.id : String(it);
              const found = items.find((g: any) => g.id === id);
              if (found) {
                return (
                  <View key={id + idx} style={styles.aiItemChip}>
                    <Image source={{ uri: found.uri }} style={styles.aiItemImage} />
                    <Text style={styles.aiItemName} numberOfLines={1}>{found.brand || found.category}</Text>
                  </View>
                );
              }

              // Fallback: show placeholder with ID
              return (
                <View key={id + idx} style={[styles.aiItemChip, styles.aiItemPlaceholder]}>
                  <Text style={styles.aiItemName}>#{String(id)}</Text>
                </View>
              );
            })}
          </View>

          {/* Why / explanation */}
          {((aiOutfit as any).why || aiOutfit.context) && (
            <Text style={styles.aiResultText}>
              {((aiOutfit as any).why) ? (aiOutfit as any).why : `Context: ${aiOutfit.context}`}
            </Text>
          )}

          {/* Feedback row (stub) */}
          <View style={styles.feedbackRow}>
            <Pressable
              style={styles.feedbackButton}
              onPress={async () => {
                try {
                  console.log('[OutfitIdeasScreen] Feedback: like', aiOutfit);
                  const payload = { user_id: user?.id, outfit_items: aiOutfit?.items?.map((it:any)=> typeof it === 'string' ? it : it.id) ?? [], label: 'like' };
                  await client.post('/feedback', payload);
                  Alert.alert('Thanks!', 'Your feedback was recorded.');
                } catch (err) {
                  console.warn('[OutfitIdeasScreen] Feedback error:', err);
                }
              }}
            >
              <Text style={styles.feedbackText}>👍 Like</Text>
            </Pressable>
            <Pressable
              style={[styles.feedbackButton, styles.feedbackNegative]}
              onPress={async () => {
                try {
                  console.log('[OutfitIdeasScreen] Feedback: dislike', aiOutfit);
                  const payload = { user_id: user?.id, outfit_items: aiOutfit?.items?.map((it:any)=> typeof it === 'string' ? it : it.id) ?? [], label: 'dislike' };
                  await client.post('/feedback', payload);
                  Alert.alert('Thanks!', 'Your feedback was recorded.');
                } catch (err) {
                  console.warn('[OutfitIdeasScreen] Feedback error:', err);
                }
              }}
            >
              <Text style={styles.feedbackText}>👎 Dislike</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.chipContainer}>
        {["date-night", "casual", "formal", "work", "party"].map((c) => (
          <Pressable 
            key={c} 
            onPress={() => setContext(c as any)} 
            style={[styles.chip, context === c && styles.chipActive]}
          >
            <Text style={[styles.chipText, context === c && styles.chipTextActive]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      {ideas.length === 0 ? (
        <Text style={styles.emptyText}>Not enough items in your closet for this context yet.</Text>
      ) : (
        <FlatList
          data={ideas}
          keyExtractor={(o) => o.id}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) => <OutfitCard suggestion={item} theme={theme} />}
        />
      )}
    </View>
  );
}

function OutfitCard({ suggestion, theme }: { suggestion: OutfitSuggestion; theme: any }) {
  const styles = createStyles(theme);
  
  return (
    <View style={styles.card}>
      <View style={styles.cardImages}>
        {suggestion.items.map((it) => (
          <Image key={it.id} source={{ uri: it.uri }} style={styles.cardImage} />
        ))}
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardScore}>Score: {suggestion.score.toFixed(2)}</Text>
        <Text style={styles.cardContext}>Context: {suggestion.context}</Text>
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography['2xl'],
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  chipActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  chipText: {
    fontWeight: theme.typography.medium,
    color: theme.colors.textSecondary,
  },
  chipTextActive: {
    color: theme.colors.white,
    fontWeight: theme.typography.bold,
  },
  emptyText: {
    color: theme.colors.textTertiary,
    fontSize: theme.typography.base,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    backgroundColor: theme.colors.backgroundSecondary,
  },
  cardImages: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  cardImage: {
    width: 70,
    height: 70,
    borderRadius: theme.borderRadius.md,
  },
  cardContent: {
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  cardScore: {
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
  },
  cardContext: {
    color: theme.colors.textSecondary,
  },
  aiButton: {
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  aiButtonDisabled: {
    opacity: 0.6,
  },
  aiButtonText: {
    color: theme.colors.white,
    fontWeight: theme.typography.bold,
    fontSize: theme.typography.lg,
    textAlign: 'center',
  },
  aiResultCard: {
    backgroundColor: theme.colors.accent,
    opacity: 0.2,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.accent,
  },
  aiResultTitle: {
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  aiResultText: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  aiResultContext: {
    color: theme.colors.textTertiary,
    fontSize: theme.typography.sm,
  },
  aiItemsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  aiItemChip: {
    width: 88,
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundSecondary,
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
  },
  aiItemImage: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs,
  },
  aiItemName: {
    fontSize: theme.typography.xs,
    color: theme.colors.textPrimary,
    textAlign: 'center' as const,
  },
  aiItemPlaceholder: {
    backgroundColor: theme.colors.gray100,
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  feedbackButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.backgroundSecondary,
  },
  feedbackNegative: {
    backgroundColor: theme.colors.error + '20',
  },
  feedbackText: {
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.medium,
  },
});