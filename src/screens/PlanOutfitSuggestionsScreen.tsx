/**
 * Plan Outfit Suggestions — Pick an outfit for a planner slot.
 * Route params: date, slotLabel, occasion.
 * Fetches POST /api/ai/reasoned_outfits; on "Choose this outfit" → POST /api/planner, navigate back to Calendar.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useTheme } from '../context/ThemeContext';
import { getReasonedOutfits, type ReasonedOutfitEntry } from '../api/ai';
import { getPlannerRange, postPlanner, type PlannerPlan } from '../api/planner';

type Nav = NativeStackNavigationProp<RootStackParamList, 'PlanOutfitSuggestions'>;
type PlanOutfitRoute = RouteProp<RootStackParamList, 'PlanOutfitSuggestions'>;

function OutfitCard({
  outfit,
  cardIdx,
  onChoose,
  theme,
  choosing,
}: {
  outfit: ReasonedOutfitEntry;
  cardIdx: number;
  onChoose: () => void;
  theme: ReturnType<typeof useTheme>;
  choosing: boolean;
}) {
  const styles = cardStyles(theme);
  const items = outfit.items || [];
  const reasons = outfit.reasons || [];

  return (
    <View style={styles.card}>
      <View style={styles.imagesRow}>
        {items.map((item, idx) => (
          <View key={item.id ?? (item as { _id?: string })._id ?? `item-${cardIdx}-${idx}`} style={styles.thumbWrap}>
            <Image
              source={{ uri: item.cleanImageUrl || item.imageUrl }}
              style={styles.thumb}
              resizeMode="contain"
            />
          </View>
        ))}
      </View>
      {reasons.length > 0 && (
        <View style={styles.reasons}>
          <Text style={styles.reasonsTitle}>Reasons</Text>
          {reasons.map((r, i) => (
            <Text key={`reason-${cardIdx}-${i}`} style={styles.bullet}>• {r}</Text>
          ))}
        </View>
      )}
      <Pressable
        style={[styles.chooseButton, choosing && styles.chooseButtonDisabled]}
        onPress={onChoose}
        disabled={choosing}
      >
        {choosing ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.chooseButtonText}>Choose this outfit</Text>
        )}
      </Pressable>
    </View>
  );
}

export default function PlanOutfitSuggestionsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<PlanOutfitRoute>();
  const { date, slotLabel, occasion } = route.params;

  const [outfits, setOutfits] = useState<ReasonedOutfitEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [choosingId, setChoosingId] = useState<string | null>(null);

  const fetchOutfits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getReasonedOutfits({ occasion, lockedItemIds: [] });
      setOutfits(data.outfits || []);
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Failed to load suggestions');
      setOutfits([]);
    } finally {
      setLoading(false);
    }
  }, [occasion]);

  useEffect(() => {
    fetchOutfits();
  }, [fetchOutfits]);

  const handleChoose = useCallback(
    async (outfit: ReasonedOutfitEntry) => {
      const outfitId = outfit.outfitId;
      if (!outfitId) return;
      setChoosingId(outfitId);
      try {
        const range = await getPlannerRange(date, date);
        const existing = range.entries?.find((e) => e.date === date);
        const currentPlans: PlannerPlan[] = existing?.plans ?? [];
        const newPlan: PlannerPlan = {
          slotLabel: slotLabel as PlannerPlan['slotLabel'],
          occasion,
          outfitId,
          status: 'planned',
          notes: '',
        };
        const updatedPlans = [...currentPlans, newPlan];
        await postPlanner(date, updatedPlans);
        navigation.goBack();
      } catch (err) {
        setError((err as { message?: string })?.message ?? 'Failed to save plan');
      } finally {
        setChoosingId(null);
      }
    },
    [date, slotLabel, occasion, navigation]
  );

  const styles = createStyles(theme);

  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.headerRow}>
          <Pressable style={styles.headerBack} onPress={goBack}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Pick an outfit</Text>
            <Text style={styles.subtitle}>{occasion} · {slotLabel}</Text>
          </View>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.headerRow}>
        <Pressable style={styles.headerBack} onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Pick an outfit</Text>
          <Text style={styles.subtitle}>{occasion} · {slotLabel}</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {outfits.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No outfits available — add more wardrobe items or mark items as available.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {outfits.slice(0, 3).map((outfit, idx) => (
            <OutfitCard
              key={outfit.outfitId ?? `outfit-${idx}`}
              outfit={outfit}
              cardIdx={idx}
              onChoose={() => handleChoose(outfit)}
              theme={theme}
              choosing={choosingId === outfit.outfitId}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerBack: { padding: theme.spacing.sm, marginRight: theme.spacing.xs },
    headerCenter: { flex: 1 },
    title: {
      fontSize: theme.typography.xl,
      fontWeight: theme.typography.bold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    subtitle: {
      fontSize: theme.typography.sm,
      color: theme.colors.textSecondary,
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing['2xl'] },
    errorWrap: {
      paddingHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },
    errorText: { fontSize: theme.typography.sm, color: theme.colors.error },
    empty: {
      flex: 1,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.xl,
    },
    emptyText: {
      fontSize: theme.typography.base,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });
}

function cardStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    imagesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    thumbWrap: {
      width: 72,
      height: 72,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.backgroundTertiary ?? theme.colors.background,
      overflow: 'hidden',
    },
    thumb: { width: '100%', height: '100%' },
    reasons: { marginTop: theme.spacing.xs, marginBottom: theme.spacing.md },
    reasonsTitle: {
      fontSize: theme.typography.sm,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    bullet: { fontSize: theme.typography.xs, color: theme.colors.textSecondary, marginLeft: theme.spacing.sm },
    chooseButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.borderRadius.md,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
    },
    chooseButtonDisabled: { opacity: 0.7 },
    chooseButtonText: { fontSize: theme.typography.sm, fontWeight: '600', color: theme.colors.white },
  });
}
