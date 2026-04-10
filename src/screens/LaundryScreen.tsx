/**
 * Laundry Screen — shows items currently in laundry (or packed).
 * Mark individual items or all items as clean.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  ListRenderItemInfo,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { listLaundry, markClean, WardrobeItemResponse } from '../api/wardrobe';
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
} as const;

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });
const H_PAD = 24;
const { width: LAUNDRY_SCREEN_W } = Dimensions.get('window');
const LAUNDRY_CARD_W = wardrobeGridCardWidth(LAUNDRY_SCREEN_W, H_PAD, WARDROBE_GRID_GAP);

function getItemName(item: WardrobeItemResponse): string {
  return item.profile?.type as string
    || item.type
    || item.profile?.category as string
    || item.category
    || 'Item';
}

function getStatusLabel(item: WardrobeItemResponse): string {
  const reason = item.v2?.availability?.reason;
  if (reason === 'packed') return 'Packed';
  return 'In Laundry';
}

function LaundryItemGridCard({
  item,
  onMarkClean,
  busy,
}: Readonly<{
  item: WardrobeItemResponse;
  onMarkClean: (id: string) => void;
  busy: boolean;
}>) {
  const itemId = item.id ?? item._id ?? '';
  const uri = item.cleanImageUrl || item.imageUrl || null;
  const isPacked = item.v2?.availability?.reason === 'packed';

  return (
    <WardrobeSquareGridCard
      width={LAUNDRY_CARD_W}
      imageUri={uri}
      title={getItemName(item)}
      badge={
        <View style={[styles.gridStatusBadge, isPacked && styles.gridStatusBadgePacked]}>
          <Text style={[styles.gridStatusText, isPacked && styles.gridStatusTextPacked]}>
            {isPacked ? 'Packed' : 'In Laundry'}
          </Text>
        </View>
      }
      metaFooter={
        <Pressable
          style={({ pressed }) => [styles.gridCleanBtn, pressed && { opacity: 0.85 }]}
          onPress={() => onMarkClean(itemId)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Mark as clean"
        >
          {busy ? (
            <ActivityIndicator size="small" color={P.accent} />
          ) : (
            <Text style={styles.gridCleanBtnText}>Clean</Text>
          )}
        </Pressable>
      }
    />
  );
}

export default function LaundryScreen() {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const { user, token } = useAuth();

  const [items, setItems] = useState<WardrobeItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includePacked, setIncludePacked] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [cleaningAll, setCleaningAll] = useState(false);
  const loadingRef = useRef(false);

  const loadItems = useCallback(async () => {
    if (!user || !token) { setItems([]); setLoading(false); return; }
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      setLoading(true);
      setError(null);
      const result = await listLaundry(includePacked);
      setItems(result.items ?? []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load laundry items.');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [user, token, includePacked]);

  useEffect(() => {
    if (isFocused) void loadItems();
  }, [isFocused, loadItems]);

  const handleMarkClean = useCallback(async (itemId: string) => {
    setBusyIds((prev) => new Set(prev).add(itemId));
    try {
      await markClean([itemId]);
      setItems((prev) => prev.filter((i) => (i.id ?? i._id) !== itemId));
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to mark as clean.');
    } finally {
      setBusyIds((prev) => { const s = new Set(prev); s.delete(itemId); return s; });
    }
  }, []);

  const handleCleanAll = useCallback(async () => {
    const ids = items.map((i) => i.id ?? i._id ?? '').filter(Boolean);
    if (ids.length === 0) return;
    setCleaningAll(true);
    try {
      await markClean(ids);
      setItems([]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to clean all.');
    } finally {
      setCleaningAll(false);
    }
  }, [items]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<WardrobeItemResponse>) => (
      <LaundryItemGridCard
        item={item}
        onMarkClean={handleMarkClean}
        busy={busyIds.has(item.id ?? item._id ?? '')}
      />
    ),
    [handleMarkClean, busyIds],
  );

  if (!user) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.centerText}>Sign in to see your laundry</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={P.primaryText} />
        </Pressable>
        <Text style={styles.title}>LAUNDRY</Text>
        <Ionicons name="basket-outline" size={22} color={P.accent} style={{ marginLeft: 6 }} />
      </View>

      {/* Include packed toggle */}
      <Pressable
        style={[styles.toggleRow, includePacked && styles.toggleRowActive]}
        onPress={() => setIncludePacked((v) => !v)}
      >
        <Ionicons
          name={includePacked ? 'checkbox-outline' : 'square-outline'}
          size={16}
          color={includePacked ? P.accent : P.secondaryText}
        />
        <Text style={[styles.toggleText, includePacked && { color: P.accent }]}>
          Include packed items
        </Text>
      </Pressable>

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={P.accent} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="basket-outline" size={48} color={P.lightText} style={{ marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>No items in laundry</Text>
          <Text style={styles.emptyHint}>All your clothes are ready to wear!</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            numColumns={2}
            keyExtractor={(i, idx) => i.id ?? i._id ?? `l-${idx}`}
            contentContainerStyle={styles.list}
            columnWrapperStyle={styles.gridColumnWrapper}
            showsVerticalScrollIndicator={false}
            renderItem={renderItem}
          />

          {/* Clean all CTA */}
          <View style={styles.bottomBar}>
            <Pressable
              style={({ pressed }) => [styles.cleanAllBtn, pressed && { opacity: 0.85 }]}
              onPress={handleCleanAll}
              disabled={cleaningAll}
            >
              {cleaningAll ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.cleanAllText}>CLEAN ALL ({items.length})</Text>
              )}
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.background },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  centerText:{ fontSize: 15, color: P.secondaryText },

  header: {
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
  title: {
    fontFamily: SERIF,
    fontSize: 28,
    fontWeight: '700',
    color: P.primaryText,
    letterSpacing: -0.3,
  },
  titleIcon: { marginLeft: 6 },

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
  toggleText: { fontSize: 13, color: P.secondaryText },

  errorText: { fontSize: 13, color: '#C8706A', marginHorizontal: H_PAD, marginBottom: 8 },

  list: {
    paddingHorizontal: H_PAD,
    paddingBottom: 100,
    paddingTop: 4,
  },
  gridColumnWrapper: {
    gap: WARDROBE_GRID_GAP,
  },

  gridStatusBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: `${P.warning}20`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  gridStatusBadgePacked: {
    backgroundColor: `${P.accent}20`,
  },
  gridStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: P.warning,
  },
  gridStatusTextPacked: {
    color: P.accent,
  },

  gridCleanBtn: {
    marginTop: 8,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F7F2EC',
    borderWidth: 1,
    borderColor: 'rgba(196,168,130,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  gridCleanBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2C1A0E',
    letterSpacing: 0.3,
  },

  emptyIcon: { marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: P.primaryText, marginBottom: 6 },
  emptyHint:  { fontSize: 13, color: P.lightText },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: H_PAD,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: P.background,
    borderTopWidth: 1,
    borderTopColor: P.border,
  },
  cleanAllBtn: {
    height: 50,
    borderRadius: 16,
    backgroundColor: P.primaryText,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cleanAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});
