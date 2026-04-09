/**
 * Closet Screen — category grid → filtered item list drill-down.
 * All API calls, auth logic, and upload flow preserved.
 * The + add-item button lives in the bottom nav bar (Tabs.tsx), not here.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
  Dimensions,
  FlatList,
  ListRenderItemInfo,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import {
  listWardrobe,
  patchWardrobeV2,
  WardrobeItemResponse,
} from '../api/wardrobe';
import {
  WardrobeSquareGridCard,
  wardrobeGridCardWidth,
  WARDROBE_GRID_GAP,
} from '../components/wardrobe/WardrobeSquareGridCard';

const P = {
  background:    '#F5F0E8',
  cardSurface:   '#EDE6D8',
  cardWhite:     '#FFFFFF',
  primaryText:   '#3D3426',
  secondaryText: '#8C7E6A',
  lightText:     '#B5A894',
  accent:        '#C4A882',
  border:        '#E8E0D0',
  shadow:        'rgba(61, 52, 38, 0.08)',
  warning:       '#D4A574',
  error:         '#C8706A',
} as const;

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });
const { width: SCREEN_W } = Dimensions.get('window');
const H_PAD    = 24;
const GRID_GAP = 14;
const CARD_W   = (SCREEN_W - H_PAD * 2 - GRID_GAP) / 2;
/** Detail item grid — match Favorites / Saved two-column card width */
const DETAIL_CARD_W = wardrobeGridCardWidth(SCREEN_W, H_PAD, WARDROBE_GRID_GAP);

const CARD_SHADOW = {
  shadowColor: P.shadow,
  shadowOpacity: 1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

const WARDROBE_CATEGORIES = [
  { key: 'tshirt',    label: 'T-SHIRTS',    emoji: '👕' },
  { key: 'shirt',     label: 'SHIRTS',      emoji: '👔' },
  { key: 'hoodie',    label: 'HOODIES',     emoji: '🧥' },
  { key: 'pant',      label: 'PANTS',       emoji: '👖' },
  { key: 'shoes',     label: 'SHOES',       emoji: '👟' },
  { key: 'accessory', label: 'ACCESSORIES', emoji: '🎒' },
] as const;

type CategoryKey = typeof WARDROBE_CATEGORIES[number]['key'];
type CategoryDef = typeof WARDROBE_CATEGORIES[number];

/** Maps user-selected clothingType values to ClosetScreen category keys (1-to-1 for Phase 1). */
const CLOTHING_TYPE_TO_CATEGORY: Record<string, string> = {
  shirt:  'shirt',
  tshirt: 'tshirt',
  hoodie: 'hoodie',
  pant:   'pant',
};

/**
 * Maps legacy AI-inferred category values to Phase 1 display category keys.
 * Used for items uploaded before the v2 pipeline (no clothingType set).
 * Keeps older items visible without requiring a DB migration.
 */
const LEGACY_CATEGORY_MAP: Record<string, string> = {
  top:             'tshirt',    // generic top → T-Shirts tile
  bottom:          'pant',      // generic bottom → Pants tile
  outerwear:       'hoodie',    // legacy outerwear → Hoodies tile (closest match)
  shoes:           'shoes',
  accessory:       'accessory',
  dress:           'tshirt',    // edge case: map to T-Shirts
  traditional_set: 'shirt',     // edge case: map to Shirts
};

const CLOTHING_TYPE_DISPLAY: Record<string, string> = {
  shirt:  'Shirt',
  tshirt: 'T-Shirt',
  hoodie: 'Hoodie',
  pant:   'Pant',
};

/**
 * Returns the wardrobe category key for an item.
 * Priority: user-selected clothingType → legacy AI category fallback
 * Phase 1 clothingType values map 1-to-1 to their own tile.
 * Legacy items (no clothingType) are remapped via LEGACY_CATEGORY_MAP so
 * they still appear somewhere sensible without a DB migration.
 */
function getItemCategory(item: WardrobeItemResponse): string {
  const ct = item.clothingType?.toLowerCase();
  if (ct && CLOTHING_TYPE_TO_CATEGORY[ct]) {
    return CLOTHING_TYPE_TO_CATEGORY[ct];
  }
  const aiCat = (item.profile?.category ?? item.category ?? '').toLowerCase();
  return LEGACY_CATEGORY_MAP[aiCat] ?? aiCat;
}

/**
 * Derives a human-readable display name from item data.
 * Priority: user clothingType → AI profile.type → AI profile.category → "Item"
 * Color prefix (AI profile.primaryColor) prepended when available.
 * Examples: "Blue T-Shirt", "Black Hoodie", "White Shirt", "Hoodie"
 */
function getItemDisplayName(item: WardrobeItemResponse): string {
  const ct = item.clothingType?.toLowerCase();

  // 1. Determine type label
  let typeLabel: string;
  if (ct && CLOTHING_TYPE_DISPLAY[ct]) {
    typeLabel = CLOTHING_TYPE_DISPLAY[ct];
  } else {
    const aiType = typeof item.profile?.type === 'string' ? item.profile.type : '';
    if (aiType && aiType.toLowerCase() !== 'unknown') {
      typeLabel = aiType.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    } else {
      const aiCat = typeof item.profile?.category === 'string' ? item.profile.category : (item.category ?? '');
      typeLabel = aiCat && aiCat.toLowerCase() !== 'unknown'
        ? aiCat.charAt(0).toUpperCase() + aiCat.slice(1)
        : 'Item';
    }
  }

  // 2. Color prefix from AI primaryColor
  const rawColor = item.profile?.primaryColor;
  const color = typeof rawColor === 'string' && rawColor.trim() && rawColor.toLowerCase() !== 'unknown'
    ? rawColor.trim()
    : '';

  return color ? `${color} ${typeLabel}` : typeLabel;
}

function countLabel(n: number): string {
  return n === 1 ? '1 item' : `${n} items`;
}

// ─── Category card for the grid ──────────────────────────────────────────────
function CategoryCard({
  cat, count, onPress,
}: Readonly<{ cat: CategoryDef; count: number; onPress: () => void }>) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.categoryCard,
        pressed && { transform: [{ translateY: -3 }] },
      ]}
      onPress={onPress}
    >
      <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
      <Text style={styles.categoryLabel}>{cat.label}</Text>
      <Text style={styles.categoryCount}>{countLabel(count)}</Text>
    </Pressable>
  );
}

// ─── Item grid card (detail view) — same chrome as Favorites / Saved grids ───
function ClosetItemGridCard({
  item,
  cardWidth,
  onSetAvailability,
  onPress,
}: Readonly<{
  item: WardrobeItemResponse;
  cardWidth: number;
  onSetAvailability: (id: string, unavailable: boolean) => void;
  onPress: () => void;
}>) {
  const itemId = item.id ?? item._id ?? '';
  const isUnavailable = item.v2?.availability?.status === 'unavailable';
  const itemName = getItemDisplayName(item);
  const uri = (item.cleanImageUrl || item.imageUrl) || null;

  return (
    <View style={isUnavailable ? styles.gridCardDimmed : undefined}>
      <WardrobeSquareGridCard
        width={cardWidth}
        imageUri={uri}
        title={itemName}
        onPress={onPress}
        badge={
          isUnavailable ? (
            <View style={styles.gridLaundryBadge}>
              <Text style={styles.gridLaundryBadgeText}>🧺 In Laundry</Text>
            </View>
          ) : null
        }
        imageOverlay={
          <Pressable
            style={[styles.gridLaundryBtn, isUnavailable && styles.gridLaundryBtnActive]}
            onPress={() => onSetAvailability(itemId, !isUnavailable)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={isUnavailable ? 'Mark as available' : 'Mark as laundry'}
          >
            <Text style={styles.gridLaundryBtnEmoji}>🧺</Text>
          </Pressable>
        }
      />
    </View>
  );
}

// ─── Detail view (filtered items for a category) ────────────────────────────
function ClosetDetailView({
  catDef,
  filteredItems,
  loading,
  error,
  toast,
  showUnavailable,
  onToggleUnavailable,
  onBack,
  onSetAvailability,
  onPressItem,
}: Readonly<{
  catDef: CategoryDef;
  filteredItems: WardrobeItemResponse[];
  loading: boolean;
  error: string | null;
  toast: string | null;
  showUnavailable: boolean;
  onToggleUnavailable: () => void;
  onBack: () => void;
  onSetAvailability: (id: string, unavailable: boolean) => void;
  onPressItem: (item: WardrobeItemResponse) => void;
}>) {
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<WardrobeItemResponse>) => (
      <ClosetItemGridCard
        item={item}
        cardWidth={DETAIL_CARD_W}
        onSetAvailability={onSetAvailability}
        onPress={() => onPressItem(item)}
      />
    ),
    [onSetAvailability, onPressItem],
  );

  let bodyContent: React.ReactNode;
  if (loading) {
    bodyContent = (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={P.accent} />
      </View>
    );
  } else if (filteredItems.length === 0) {
    bodyContent = (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>{catDef.emoji}</Text>
        <Text style={styles.emptyText}>No items in {catDef.label.toLowerCase()} yet</Text>
        <Text style={styles.emptyHint}>Tap the + button below to add one</Text>
      </View>
    );
  } else {
    bodyContent = (
      <FlatList
        data={filteredItems}
        numColumns={2}
        keyExtractor={(i, idx) => i.id ?? i._id ?? `item-${idx}`}
        contentContainerStyle={styles.detailList}
        columnWrapperStyle={styles.gridColumnWrapper}
        showsVerticalScrollIndicator={false}
        renderItem={renderItem}
      />
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.detailHeader}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={P.primaryText} />
        </Pressable>
        <Text style={styles.detailTitle}>{catDef.emoji} {catDef.label}</Text>
      </View>

      {!!error && <Text style={styles.errorText}>{error}</Text>}
      {!!toast  && <Text style={styles.toastInline}>{toast}</Text>}

      {/* Show unavailable toggle */}
      <Pressable
        style={[styles.toggleRow, showUnavailable && styles.toggleRowActive]}
        onPress={onToggleUnavailable}
      >
        <Ionicons
          name={showUnavailable ? 'eye-outline' : 'eye-off-outline'}
          size={16}
          color={showUnavailable ? P.accent : P.secondaryText}
        />
        <Text style={[styles.toggleText, showUnavailable && { color: P.accent }]}>
          {showUnavailable ? 'Hiding unavailable' : 'Show unavailable (laundry/packed)'}
        </Text>
      </Pressable>

      {bodyContent}
    </SafeAreaView>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function ClosetScreen() {
  const { user, token } = useAuth();
  const isFocused = useIsFocused();
  const navigation = useNavigation<any>();

  const [items,            setItems]            = useState<WardrobeItemResponse[]>([]);
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState<string | null>(null);
  const [showUnavailable,  setShowUnavailable]  = useState(false);
  const [toast,            setToast]            = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey | null>(null);
  const loadingRef = useRef(false);

  // Android back-button support in detail view
  useEffect(() => {
    if (!selectedCategory) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedCategory(null);
      return true;
    });
    return () => sub.remove();
  }, [selectedCategory]);

  const loadWardrobe = useCallback(async () => {
    if (!user || !token) { setItems([]); return; }
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      setLoading(true);
      setError(null);
      setItems(await listWardrobe(showUnavailable));
    } catch (err: any) {
      setError(err?.message || 'Failed to load wardrobe.');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [user, token, showUnavailable]);

  const setAvailability = useCallback(async (itemId: string, unavailable: boolean) => {
    try {
      const patch = unavailable
        ? { availability: { status: 'unavailable' as const, reason: 'laundry' as const, untilDate: null } }
        : { availability: { status: 'available'   as const, reason: null, untilDate: null } };
      await patchWardrobeV2(itemId, patch);
      setToast(unavailable ? 'Marked as laundry.' : 'Marked as available.');
      await loadWardrobe();
      setTimeout(() => setToast(null), 2500);
    } catch (err: any) {
      setError(err?.message || 'Failed to update.');
    }
  }, [loadWardrobe]);

  useEffect(() => {
    if (!user || !token) { setItems([]); return; }
    if (isFocused) void loadWardrobe();
  }, [isFocused, user, token, loadWardrobe]);

  const getCategoryCount = useCallback(
    (key: string) => items.filter((i) => getItemCategory(i) === key).length,
    [items],
  );

  // ── Auth guard ────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.centerText}>Sign in to see your closet</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Detail view ───────────────────────────────────────────────────────────
  if (selectedCategory) {
    const catDef   = WARDROBE_CATEGORIES.find((c) => c.key === selectedCategory)!;
    const filtered = items.filter((i) => getItemCategory(i) === selectedCategory);
    return (
      <ClosetDetailView
        catDef={catDef}
        filteredItems={filtered}
        loading={loading}
        error={error}
        toast={toast}
        showUnavailable={showUnavailable}
        onToggleUnavailable={() => setShowUnavailable((v) => !v)}
        onBack={() => setSelectedCategory(null)}
        onSetAvailability={(id, u) => void setAvailability(id, u)}
        onPressItem={(item) => {
          navigation.navigate('ClosetItemDetail', {
            itemId:        item.id ?? item._id ?? '',
            frontImageUrl: item.cleanImageUrl || item.imageUrl,
            backImageUrl:  item.backImageUrl ?? null,
            itemName:      getItemDisplayName(item),
            isFavorite:    item.isFavorite ?? false,
          });
        }}
      />
    );
  }

  // ── Category grid view ────────────────────────────────────────────────────
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.gridScroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>MY CLOSET</Text>
          <View style={styles.headerRight}>
            <Pressable style={styles.pillBtn} onPress={() => {}}>
              <Text style={styles.pillEmoji}>🔍</Text>
            </Pressable>
            <Pressable style={styles.pillBtn} onPress={() => navigation.navigate('Laundry')}>
              <Text style={styles.pillEmoji}>🧺</Text>
            </Pressable>
          </View>
        </View>

        {!!error && <Text style={styles.errorText}>{error}</Text>}
        {!!toast && <Text style={styles.toastInline}>{toast}</Text>}

        {loading ? (
          <View style={[styles.center, { marginTop: 60 }]}>
            <ActivityIndicator size="large" color={P.accent} />
            <Text style={[styles.centerText, { marginTop: 12 }]}>Loading wardrobe…</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {WARDROBE_CATEGORIES.map((cat) => (
              <CategoryCard
                key={cat.key}
                cat={cat}
                count={getCategoryCount(cat.key)}
                onPress={() => setSelectedCategory(cat.key)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.background },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centerText:{ fontSize: 15, color: P.secondaryText },

  // ── Grid view ─────────────────────────────────────────────────────────────
  gridScroll: { paddingHorizontal: H_PAD, paddingBottom: 100 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 20,
  },
  pageTitle: {
    fontFamily: SERIF,
    fontSize: 30,
    fontWeight: '700',
    color: P.primaryText,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 8,
  },
  pillBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: P.cardWhite,
    borderWidth: 1,
    borderColor: P.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...CARD_SHADOW,
  },
  pillEmoji: { fontSize: 17 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  categoryCard: {
    width: CARD_W,
    backgroundColor: P.cardWhite,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: P.border,
    ...CARD_SHADOW,
  },
  categoryEmoji: { fontSize: 32, marginBottom: 10 },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: P.primaryText,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
    textAlign: 'center',
  },
  categoryCount: { fontSize: 10, color: P.secondaryText },

  // ── Detail view ───────────────────────────────────────────────────────────
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: P.cardSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: P.primaryText,
    letterSpacing: -0.3,
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: H_PAD,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: P.cardSurface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: P.border,
  },
  toggleRowActive: { borderColor: P.accent },
  toggleText:      { fontSize: 13, color: P.secondaryText },

  detailList: {
    paddingHorizontal: H_PAD,
    paddingBottom: 100,
    paddingTop: 4,
  },
  gridColumnWrapper: {
    gap: WARDROBE_GRID_GAP,
  },
  gridCardDimmed: { opacity: 0.92 },

  gridLaundryBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: `${P.warning}20`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  gridLaundryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: P.warning,
  },
  gridLaundryBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(196,168,130,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2C1A0E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  gridLaundryBtnActive: {
    backgroundColor: `${P.warning}25`,
    borderColor: P.warning,
  },
  gridLaundryBtnEmoji: { fontSize: 15 },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText:  { fontSize: 15, color: P.secondaryText, marginBottom: 6 },
  emptyHint:  { fontSize: 13, color: P.lightText },

  // ── Error / toast ─────────────────────────────────────────────────────────
  errorText:   { fontSize: 13, color: P.error,  marginHorizontal: H_PAD, marginBottom: 8 },
  toastInline: { fontSize: 13, color: P.accent, marginHorizontal: H_PAD, marginBottom: 8, fontWeight: '600' },
});
