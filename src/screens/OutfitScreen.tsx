/**
 * Outfit Screen (v1) — Occasion picker, POST /api/ai/reasoned_outfits, up to 3 outfit cards.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getReasonedOutfits, ReasonedOutfitsResponse, ReasonedOutfitEntry } from '../api/ai';

const OCCASIONS = ['college', 'casual', 'work', 'formal', 'party', 'gym', 'date', 'traditional'];

const DALLAS_LOCATION = { latitude: 32.7767, longitude: -96.797 };

export default function OutfitScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [occasion, setOccasion] = useState<string>(OCCASIONS[0]);
  const [includeDallas, setIncludeDallas] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReasonedOutfitsResponse | null>(null);

  const fetchOutfits = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      const body: { occasion: string; location?: { latitude: number; longitude: number } } = {
        occasion,
      };
      if (includeDallas) body.location = DALLAS_LOCATION;
      const data = await getReasonedOutfits(body);
      setResult(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to get outfits. Please try again.');
      Alert.alert('Error', err?.message || 'Failed to get outfits.');
    } finally {
      setLoading(false);
    }
  };

  const styles = createStyles(theme);

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.title}>Sign in to get outfit ideas</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Occasion</Text>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={occasion}
            onValueChange={setOccasion}
            style={styles.picker}
            dropdownIconColor={theme.colors.textPrimary}
          >
            {OCCASIONS.map((o) => (
              <Picker.Item key={o} label={o} value={o} />
            ))}
          </Picker>
        </View>

        <Pressable
          style={[styles.toggle, includeDallas && styles.toggleActive]}
          onPress={() => setIncludeDallas((v) => !v)}
        >
          <Text style={styles.toggleText}>Include Dallas location (weather)</Text>
        </Pressable>

        <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={fetchOutfits} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.buttonText}>Get Outfits</Text>}
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {result && (
          <>
            <View style={styles.engineCard}>
              <Text style={styles.engineTitle}>Engine</Text>
              <Text style={styles.engineText}>engine: {result.engine}</Text>
              <Text style={styles.engineText}>pythonUsed: {result.pythonUsed ? 'true' : 'false'}</Text>
              {result.pythonError ? <Text style={styles.engineError}>pythonError: {result.pythonError}</Text> : null}
              {result.contextUsed?.tempF != null && (
                <Text style={styles.engineText}>contextUsed.tempF: {result.contextUsed.tempF}</Text>
              )}
            </View>

            {result.outfits.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Add more items for better outfits</Text>
              </View>
            ) : (
              result.outfits.slice(0, 3).map((outfit, idx) => (
                <OutfitCard key={idx} outfit={outfit} theme={theme} />
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function OutfitCard({ outfit, theme }: { outfit: ReasonedOutfitEntry; theme: ReturnType<typeof useTheme> }) {
  const styles = cardStyles(theme);
  const items = outfit.items || [];
  const reasons = outfit.reasons || [];
  const missing = outfit.missing || [];

  return (
    <View style={styles.card}>
      <View style={styles.imagesRow}>
        {items.map((item) => (
          <Image
            key={item._id}
            source={{ uri: item.cleanImageUrl || item.imageUrl }}
            style={styles.thumb}
          />
        ))}
      </View>
      {reasons.length > 0 && (
        <View style={styles.reasons}>
          <Text style={styles.reasonsTitle}>Reasons</Text>
          {reasons.map((r, i) => (
            <Text key={i} style={styles.bullet}>• {r}</Text>
          ))}
        </View>
      )}
      {missing.length > 0 && (
        <Text style={styles.missing}>Missing: {missing.join(', ')}</Text>
      )}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { padding: theme.spacing.lg, paddingBottom: theme.spacing['2xl'] },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl },
    title: { fontSize: theme.typography.lg, color: theme.colors.textSecondary },
    label: { fontSize: theme.typography.sm, color: theme.colors.textSecondary, marginBottom: theme.spacing.xs },
    pickerWrap: { backgroundColor: theme.colors.backgroundSecondary, borderRadius: theme.borderRadius.lg, borderWidth: 1, borderColor: theme.colors.border, marginBottom: theme.spacing.md },
    picker: { color: theme.colors.textPrimary },
    toggle: { paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.md, backgroundColor: theme.colors.backgroundSecondary, borderRadius: theme.borderRadius.lg, borderWidth: 1, borderColor: theme.colors.border },
    toggleActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accent + '15' },
    toggleText: { fontSize: theme.typography.sm, color: theme.colors.textPrimary },
    button: { backgroundColor: theme.colors.accent, borderRadius: theme.borderRadius.lg, paddingVertical: theme.spacing.lg, alignItems: 'center', marginBottom: theme.spacing.lg },
    buttonDisabled: { opacity: 0.7 },
    buttonText: { fontSize: theme.typography.base, fontWeight: '600', color: theme.colors.white },
    errorText: { fontSize: theme.typography.sm, color: theme.colors.error, marginBottom: theme.spacing.md },
    engineCard: { backgroundColor: theme.colors.backgroundSecondary, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.xl, borderWidth: 1, borderColor: theme.colors.border },
    engineTitle: { fontSize: theme.typography.sm, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: theme.spacing.sm },
    engineText: { fontSize: theme.typography.xs, color: theme.colors.textSecondary },
    engineError: { fontSize: theme.typography.xs, color: theme.colors.error, marginTop: theme.spacing.xs },
    empty: { paddingVertical: theme.spacing.xl },
    emptyText: { fontSize: theme.typography.base, color: theme.colors.textSecondary, textAlign: 'center' },
  });
}

function cardStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    card: { backgroundColor: theme.colors.backgroundSecondary, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border },
    imagesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
    thumb: { width: 64, height: 64, borderRadius: theme.borderRadius.md },
    reasons: { marginTop: theme.spacing.xs },
    reasonsTitle: { fontSize: theme.typography.sm, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: theme.spacing.xs },
    bullet: { fontSize: theme.typography.xs, color: theme.colors.textSecondary, marginLeft: theme.spacing.sm },
    missing: { fontSize: theme.typography.xs, color: theme.colors.textTertiary, marginTop: theme.spacing.sm },
  });
}
