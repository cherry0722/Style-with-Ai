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
  Image,
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
import { useIsFocused } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import {
  listWardrobe,
  patchWardrobeV2,
  WardrobeItemResponse,
} from '../api/wardrobe';

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

const CARD_SHADOW = {
  shadowColor: P.shadow,
  shadowOpacity: 1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
};

const WARDROBE_CATEGORIES = [
  { key: 'top',       label: 'T-SHIRTS',     emoji: '👕' },
  { key: 'dress',     label: 'SKIRTS',       emoji: '👗' },
  { key: 'bottom',    label: 'DRESSES',      emoji: '👘' },
  { key: 'outerwear', label: 'PANTS',        emoji: '👖' },
  { key: 'shoes',     label: 'SHOES',        emoji: '👟' },
  { key: 'accessory', label: 'ACCESSORIES',  emoji: '🎒' },
] as const;

type CategoryKey = typeof WARDROBE_CATEGORIES[number]['key'];
type CategoryDef = typeof WARDROBE_CATEGORIES[number];

function getItemCategory(item: WardrobeItemResponse): string {
  return (item.profile?.category ?? item.category ?? '').toLowerCase();
}

function countLabel(n: number): string {
  return n === 1 ? '1 item' : `${n} items`;
}

function ListSeparator() {
  return <View style={separatorStyle.gap} />;
}
const separatorStyle = StyleSheet.create({ gap: { height: 10 } });

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

// ─── Item row card for the detail view ───────────────────────────────────────
function ItemRowCard({
  item,
  onSetAvailability,
}: Readonly<{
  item: WardrobeItemResponse;
  onSetAvailability: (id: string, unavailable: boolean) => void;
}>) {
  const itemId        = item.id ?? item._id ?? '';
  const isUnavailable = item.v2?.availability?.status === 'unavailable';
  const itemName      = item.profile?.type ?? item.type ?? item.profile?.category ?? item.category ?? '—';

  return (
    <View style={[styles.itemRow, isUnavailable && styles.itemRowUnavailable]}>
      {/* Thumbnail */}
      <View style={styles.itemThumbWrap}>
        {(item.cleanImageUrl || item.imageUrl) ? (
          <Image
            source={{ uri: item.cleanImageUrl || item.imageUrl }}
            style={styles.itemThumb}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.itemThumbPlaceholder}>
            <Ionicons name="shirt-outline" size={20} color={P.lightText} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{itemName}</Text>
        {isUnavailable && (
          <View style={styles.laundryBadge}>
            <Text style={styles.laundryBadgeText}>🧺 In Laundry</Text>
          </View>
        )}
      </View>

      {/* Laundry toggle button */}
      <Pressable
        style={[styles.laundryBtn, isUnavailable && styles.laundryBtnActive]}
        onPress={() => onSetAvailability(itemId, !isUnavailable)}
        hitSlop={6}
      >
        <Text style={styles.laundryBtnEmoji}>🧺</Text>
      </Pressable>
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
}>) {
  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<WardrobeItemResponse>) => (
      <ItemRowCard item={item} onSetAvailability={onSetAvailability} />
    ),
    [onSetAvailability],
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
        keyExtractor={(i, idx) => i.id ?? i._id ?? `item-${idx}`}
        contentContainerStyle={styles.detailList}
        showsVerticalScrollIndicator={false}
        renderItem={renderItem}
        ItemSeparatorComponent={ListSeparator}
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
            <Pressable style={styles.pillBtn} onPress={() => {}}>
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
  itemSeparator: { height: 10 },

  // ── Item row card ─────────────────────────────────────────────────────────
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.cardWhite,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: P.border,
    padding: 12,
    gap: 12,
    ...CARD_SHADOW,
  },
  itemRowUnavailable: { opacity: 0.5 },

  itemThumbWrap: {
    width: 50,
    height: 50,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: P.cardSurface,
  },
  itemThumb: { width: '100%', height: '100%' },
  itemThumbPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  itemInfo: { flex: 1 },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: P.primaryText,
  },
  laundryBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: `${P.warning}20`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  laundryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: P.warning,
  },

  laundryBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: P.cardSurface,
    borderWidth: 1,
    borderColor: P.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  laundryBtnActive: {
    backgroundColor: `${P.warning}20`,
    borderColor: P.warning,
  },
  laundryBtnEmoji: { fontSize: 16 },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText:  { fontSize: 15, color: P.secondaryText, marginBottom: 6 },
  emptyHint:  { fontSize: 13, color: P.lightText },

  // ── Error / toast ─────────────────────────────────────────────────────────
  errorText:   { fontSize: 13, color: P.error,  marginHorizontal: H_PAD, marginBottom: 8 },
  toastInline: { fontSize: 13, color: P.accent, marginHorizontal: H_PAD, marginBottom: 8, fontWeight: '600' },
});
