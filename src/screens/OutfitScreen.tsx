/**
 * Outfit Screen — occasion picker, POST /api/ai/reasoned_outfits.
 * After generation: single-outfit result view with arrow navigation + action row.
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
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { getReasonedOutfits, ReasonedOutfitsResponse, ReasonedOutfitEntry } from '../api/ai';

const P = {
  background:    '#F5F0E8',
  cardSurface:   '#EDE6D8',
  cardWhite:     '#FFFFFF',
  primaryText:   '#3D3426',
  secondaryText: '#8C7E6A',
  lightText:     '#B5A894',
  accent:        '#C4A882',
  accentLight:   '#E8D9C5',
  border:        '#E8E0D0',
  shadow:        'rgba(61, 52, 38, 0.08)',
  error:         '#C8706A',
  skin:          '#DEAD8F',
  skinDark:      '#C9956E',
  hair:          '#5C4A3A',
  pants:         '#4A5568',
  shoes:         '#F0EDE6',
} as const;

const CARD_SHADOW = {
  shadowColor: P.shadow,
  shadowOpacity: 1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

const OCCASIONS = [
  { key: 'college',     label: 'College' },
  { key: 'casual',      label: 'Casual' },
  { key: 'traditional', label: 'Traditional' },
  { key: 'work',        label: 'Work' },
  { key: 'outing',      label: 'Outing' },
  { key: 'date',        label: 'Date' },
];

// ─── Result view (post-generation) ──────────────────────────────────────────
function OutfitResultView({
  outfits,
  onBack,
}: Readonly<{ outfits: ReasonedOutfitEntry[]; onBack: () => void }>) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [saved,  setSaved]  = useState(false);
  const [liked,  setLiked]  = useState(false);

  const total   = outfits.length;
  const outfit  = outfits[currentIdx];
  const items   = outfit?.items ?? [];
  const reasons = outfit?.reasons ?? [];
  const missing = outfit?.missing ?? [];

  const goPrev = () => setCurrentIdx((i) => Math.max(0, i - 1));
  const goNext = () => setCurrentIdx((i) => Math.min(total - 1, i + 1));

  return (
    <ScrollView style={styles.resultScroll} contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
      {/* Change occasion link */}
      <Pressable style={styles.resultBackBtn} onPress={onBack}>
        <Ionicons name="arrow-back" size={16} color={P.secondaryText} />
        <Text style={styles.resultBackText}>Change occasion</Text>
      </Pressable>

      {/* Avatar + outfit card with arrows */}
      <View style={styles.outfitAreaRow}>
        {/* Left arrow */}
        <Pressable
          style={[styles.arrowBtn, currentIdx === 0 && styles.arrowBtnDisabled]}
          onPress={goPrev}
          disabled={currentIdx === 0}
        >
          <Ionicons name="chevron-back" size={18} color={currentIdx === 0 ? P.lightText : P.primaryText} />
        </Pressable>

        {/* Center: outfit card */}
        <View style={styles.outfitCard}>
          {/* Mini avatar */}
          <View style={styles.miniAvatar}>
            <View style={styles.miniHair} />
            <View style={styles.miniFace}>
              <View style={styles.miniEyeRow}>
                <View style={styles.miniEye} />
                <View style={styles.miniEye} />
              </View>
            </View>
            <View style={styles.miniNeck} />
            <View style={styles.miniTorso} />
            <View style={styles.miniLegsRow}>
              <View style={styles.miniLeg} />
              <View style={styles.miniLeg} />
            </View>
          </View>

          {/* Item thumbnails */}
          {items.length > 0 && (
            <View style={styles.thumbRow}>
              {items.slice(0, 4).map((item, idx) => (
                <View key={item.id ?? item._id ?? `thumb-${idx}`} style={styles.thumbWrap}>
                  <Image
                    source={{ uri: item.cleanImageUrl || item.imageUrl }}
                    style={styles.thumb}
                    resizeMode="contain"
                  />
                </View>
              ))}
            </View>
          )}

          {missing.length > 0 && (
            <Text style={styles.missingText}>Missing: {missing.join(', ')}</Text>
          )}

          <Text style={styles.outfitCounter}>Outfit {currentIdx + 1} of {total}</Text>
        </View>

        {/* Right arrow */}
        <Pressable
          style={[styles.arrowBtn, currentIdx === total - 1 && styles.arrowBtnDisabled]}
          onPress={goNext}
          disabled={currentIdx === total - 1}
        >
          <Ionicons name="chevron-forward" size={18} color={currentIdx === total - 1 ? P.lightText : P.primaryText} />
        </Pressable>
      </View>

      {/* Reasons */}
      {reasons.length > 0 && (
        <View style={styles.reasonsCard}>
          <Text style={styles.reasonsTitle}>Why this works</Text>
          {reasons.map((r) => (
            <Text key={r} style={styles.reasonBullet}>· {r}</Text>
          ))}
        </View>
      )}

      {/* Action icons row */}
      <View style={styles.actionRow}>
        <Pressable
          style={[styles.actionBtn, liked && styles.actionBtnActive]}
          onPress={() => setLiked((v) => !v)}
        >
          <Text style={styles.actionEmoji}>{liked ? '❤️' : '🤍'}</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, saved && styles.actionBtnActive]}
          onPress={() => setSaved((v) => !v)}
        >
          <Text style={styles.actionEmoji}>🔖</Text>
        </Pressable>
        <Pressable
          style={styles.actionBtn}
          onPress={async () => {
            try {
              const outfit = outfits[currentIdx];
              const itemLines = outfit.items
                .map(i => `• ${i.type ?? i.category ?? 'Item'}${i.primaryColor ? ` (${i.primaryColor})` : ''}`)
                .join('\n');
              await Share.share({
                message: `Check out my outfit suggestion from Myra! ✨\n\n${itemLines}\n\nStyled for: ${outfit.reasons?.[0] ?? 'a great look'}`,
                title: 'My Myra Outfit',
              });
            } catch (err) {
              if (__DEV__) console.warn('[Share] failed:', err);
            }
          }}>
          <Text style={styles.actionEmoji}>📤</Text>
        </Pressable>
      </View>

      {/* Item clothing icons row */}
      {items.length > 0 && (
        <View style={styles.clothingIconsRow}>
          {items.slice(0, 4).map((item, idx) => (
            <View key={item.id ?? item._id ?? `icon-${idx}`} style={styles.clothingIconBtn}>
              <Ionicons name="shirt-outline" size={18} color={P.primaryText} />
            </View>
          ))}
        </View>
      )}

      {/* Select CTA */}
      <Pressable
        style={styles.selectBtn}
        onPress={() => Alert.alert('Outfit selected!', 'Add this to your calendar from the Calendar screen.')}
      >
        <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
        <Text style={styles.selectBtnText}>Select this outfit</Text>
      </Pressable>
    </ScrollView>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function OutfitScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const [occasion, setOccasion] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [result,   setResult]   = useState<ReasonedOutfitsResponse | null>(null);

  const fetchOutfits = async () => {
    if (!user || !occasion) return;
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      const body = { occasion, context: undefined };
      setResult(await getReasonedOutfits(body));
    } catch (err: any) {
      const msg = err?.message || 'Failed to get outfits. Please try again.';
      setError(msg);
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.centerText}>Sign in to get outfit ideas</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Result view ───────────────────────────────────────────────────────────
  if (result && result.outfits.length > 0) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.screenHeader}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={P.primaryText} />
          </Pressable>
          <Text style={styles.pageTitle}>OUTFIT OF THE DAY</Text>
        </View>
        <OutfitResultView
          outfits={result.outfits}
          onBack={() => setResult(null)}
        />
      </SafeAreaView>
    );
  }

  // ── Picker view ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.screenHeader}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={P.primaryText} />
        </Pressable>
        <Text style={styles.pageTitle}>OUTFIT OF THE DAY</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Text style={styles.sectionLabel}>Select the occasion:</Text>
        <View style={styles.chipsWrap}>
          {OCCASIONS.map((o) => {
            const selected = occasion === o.key;
            return (
              <Pressable
                key={o.key}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => setOccasion(o.key)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        {result?.outfits.length === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons name="shirt-outline" size={40} color={P.lightText} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>
              No outfits available — add more wardrobe items or mark laundry as available.
            </Text>
          </View>
        )}

        {result?.outfits.some((o) => (o.missing?.length ?? 0) > 0) && (
          <Text style={styles.partialHint}>Add 1–2 more items for complete outfits.</Text>
        )}

        <Pressable
          style={[
            styles.generateBtn,
            !occasion && styles.generateBtnDisabled,
            loading && { opacity: 0.75 },
          ]}
          onPress={() => void fetchOutfits()}
          disabled={loading || !occasion}
        >
          {loading
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : (
              <View style={styles.generateBtnInner}>
                <Text style={styles.generateBtnEmoji}>{result ? '↻' : '✨'}</Text>
                <Text style={[styles.generateBtnText, !occasion && styles.generateBtnTextDisabled]}>
                  {result ? 'Regenerate' : 'Generate'}
                </Text>
              </View>
            )
          }
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.background },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centerText:{ fontSize: 15, color: P.secondaryText },
  scroll:    { padding: 20, paddingBottom: 48 },

  // Header
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: P.cardSurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: P.primaryText,
    letterSpacing: -0.3,
    flex: 1,
  },

  // Occasion picker
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: P.primaryText,
    marginBottom: 14,
    marginTop: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: P.border,
    backgroundColor: P.cardWhite,
  },
  chipSelected: {
    backgroundColor: P.primaryText,
    borderColor: P.primaryText,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: P.primaryText,
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Generate button
  generateBtn: {
    backgroundColor: P.primaryText,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  generateBtnDisabled: {
    backgroundColor: P.cardSurface,
  },
  generateBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  generateBtnEmoji: { fontSize: 16, color: '#FFFFFF' },
  generateBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5 },
  generateBtnTextDisabled: { color: P.lightText },

  errorText:   { fontSize: 13, color: P.error, marginBottom: 16 },
  partialHint: { fontSize: 13, color: P.secondaryText, fontStyle: 'italic', marginBottom: 16 },

  emptyCard: {
    backgroundColor: P.cardSurface,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: P.border,
    marginBottom: 20,
  },
  emptyText: { fontSize: 14, color: P.secondaryText, textAlign: 'center', lineHeight: 20 },

  // ── Result view ───────────────────────────────────────────────────────────
  resultScroll:  { flex: 1 },
  resultContent: { padding: 20, paddingBottom: 48 },

  resultBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  resultBackText: { fontSize: 14, color: P.secondaryText },

  // Outfit area with side arrows
  outfitAreaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: P.cardWhite,
    borderWidth: 1,
    borderColor: P.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  arrowBtnDisabled: { opacity: 0.35 },

  outfitCard: {
    flex: 1,
    backgroundColor: P.cardSurface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: P.border,
    padding: 20,
    marginHorizontal: 10,
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  outfitCounter: {
    fontSize: 12,
    color: P.lightText,
    marginTop: 10,
    fontWeight: '600',
  },

  // Mini avatar figure
  miniAvatar: { alignItems: 'center', marginBottom: 12 },
  miniHair: {
    width: 36, height: 16,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    backgroundColor: P.hair, marginBottom: -4,
  },
  miniFace: {
    width: 32, height: 34, borderRadius: 16,
    backgroundColor: P.skin,
    justifyContent: 'center', alignItems: 'center',
  },
  miniEyeRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  miniEye: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: P.primaryText },
  miniNeck: { width: 10, height: 5, backgroundColor: P.skinDark },
  miniTorso: {
    width: 44, height: 36,
    borderTopLeftRadius: 10, borderTopRightRadius: 10,
    borderBottomLeftRadius: 4, borderBottomRightRadius: 4,
    backgroundColor: P.accentLight,
  },
  miniLegsRow: { flexDirection: 'row', gap: 2 },
  miniLeg: { width: 12, height: 24, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: P.pants },

  // Thumbs
  thumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  thumbWrap: {
    width: 56, height: 56, borderRadius: 10,
    backgroundColor: P.background, overflow: 'hidden',
    borderWidth: 1, borderColor: P.border,
  },
  thumb: { width: '100%', height: '100%' },
  missingText: {
    marginTop: 10, fontSize: 11, color: P.lightText,
    textAlign: 'center', fontStyle: 'italic',
  },

  // Reasons
  reasonsCard: {
    backgroundColor: P.cardWhite, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: P.border, marginBottom: 16,
  },
  reasonsTitle:  { fontSize: 13, fontWeight: '700', color: P.primaryText, marginBottom: 8, letterSpacing: 0.3 },
  reasonBullet:  { fontSize: 13, color: P.secondaryText, lineHeight: 20, marginBottom: 4 },

  // Action row
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 16,
  },
  actionBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: P.cardWhite, borderWidth: 1, borderColor: P.border,
    justifyContent: 'center', alignItems: 'center',
    ...CARD_SHADOW,
  },
  actionBtnActive: { borderColor: P.accent },
  actionEmoji: { fontSize: 20 },

  // Clothing icons
  clothingIconsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  clothingIconBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: P.cardSurface, borderWidth: 1, borderColor: P.border,
    justifyContent: 'center', alignItems: 'center',
  },

  // Select CTA
  selectBtn: {
    backgroundColor: P.primaryText,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  selectBtnText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5 },
});
