import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Image,
  ActivityIndicator,
  Dimensions,
  SectionList,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchWardrobeItems, WardrobeItemResponse } from '../api/wardrobe';
import { RootStackParamList } from '../navigation/RootNavigator';

const SCREEN_WIDTH = Dimensions.get('window').width;
const H_PADDING = 16;
const COLUMN_GAP = 12;
const CARD_SIZE = (SCREEN_WIDTH - H_PADDING * 2 - COLUMN_GAP) / 2;

const CATEGORY_ORDER = [
  'tshirt',
  'shirt',
  'hoodie',
  'pant',
  'shoe',
  'accessory',
];

const CATEGORY_LABELS: Record<string, string> = {
  tshirt:    'T-Shirts',
  shirt:     'Shirts',
  hoodie:    'Hoodies',
  pant:      'Pants',
  shoe:      'Shoes',
  accessory: 'Accessories',
};

// Normalize whatever category/type string comes from backend
function resolveCategory(item: WardrobeItemResponse): string {
  const raw = (item.clothingType ?? item.category ?? item.type ?? '').toLowerCase();
  if (raw.includes('tshirt') || raw.includes('t-shirt') || raw.includes('t_shirt')) return 'tshirt';
  if (raw.includes('shirt')) return 'shirt';
  if (raw.includes('hoodie') || raw.includes('sweatshirt')) return 'hoodie';
  if (raw.includes('pant') || raw.includes('trouser') || raw.includes('jean')) return 'pant';
  if (raw.includes('shoe') || raw.includes('sneaker') || raw.includes('boot')) return 'shoe';
  if (raw.includes('accessory') || raw.includes('bag') || raw.includes('hat')) return 'accessory';
  return 'other';
}

// ── Item Card ─────────────────────────────────────────────────────────────────

interface CardProps {
  item: WardrobeItemResponse;
  onPress: () => void;
}

function FavoriteItemCard({ item, onPress }: CardProps) {
  const imageUri = item.cleanImageUrl ?? null;

  return (
    <TouchableOpacity style={card.container} onPress={onPress} activeOpacity={0.85}>
      <View style={card.imageArea}>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={card.image}
            resizeMode="contain"
          />
        ) : (
          <View style={card.imagePlaceholder}>
            <Ionicons name="shirt-outline" size={40} color="#C4A882" />
          </View>
        )}
      </View>
      <View style={card.meta}>
        <Text style={card.name} numberOfLines={2}>
          {item.clothingType ?? item.category ?? item.type ?? 'Item'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const card = StyleSheet.create({
  container: {
    width: CARD_SIZE,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(196,168,130,0.2)',
    shadowColor: '#2C1A0E',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    marginBottom: COLUMN_GAP,
  },
  imageArea: {
    width: '100%',
    height: CARD_SIZE * 0.78,
    backgroundColor: '#F7F2EC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  placeholderIcon: {
  },
  meta: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(196,168,130,0.15)',
    backgroundColor: '#FFFFFF',
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2C1A0E',
  },
});

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={sectionHeader.container}>
      <Text style={sectionHeader.title}>{title}</Text>
      <View style={sectionHeader.badge}>
        <Text style={sectionHeader.badgeText}>{count}</Text>
      </View>
    </View>
  );
}

const sectionHeader = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PADDING,
    paddingTop: 20,
    paddingBottom: 10,
    gap: 8,
    backgroundColor: '#F2EBE0',
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2C1A0E',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  badge: {
    backgroundColor: 'rgba(196,168,130,0.25)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#C4A882',
  },
});

// ── Row renderer (pairs items into rows of 2) ─────────────────────────────────

interface RowItem {
  left: WardrobeItemResponse;
  right: WardrobeItemResponse | null;
}

function buildRows(items: WardrobeItemResponse[]): RowItem[] {
  const rows: RowItem[] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push({ left: items[i], right: items[i + 1] ?? null });
  }
  return rows;
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={empty.container}>
      <Ionicons name="heart-outline" size={48} color="#C4A882" />
      <Text style={empty.title}>No favorites yet</Text>
      <Text style={empty.subtitle}>
        Tap the heart on any clothing item in your closet to save it here
      </Text>
    </View>
  );
}

const empty = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
    gap: 12,
  },
  icon: { marginBottom: 4 },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C1A0E',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#8C7B6B',
    textAlign: 'center',
    lineHeight: 20,
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function FavoritesScreen() {
  const navigation = useNavigation<Nav>();
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<
    { key: string; title: string; data: RowItem[] }[]
  >([]);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      const all = await fetchWardrobeItems();
      const favorites = all.filter(i => i.isFavorite === true);
      setTotalCount(favorites.length);

      // Group by category
      const grouped: Record<string, WardrobeItemResponse[]> = {};
      for (const item of favorites) {
        const cat = resolveCategory(item);
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
      }

      // Build sections in defined order, skip empty categories
      const built = CATEGORY_ORDER
        .filter(cat => grouped[cat] && grouped[cat].length > 0)
        .map(cat => ({
          key: cat,
          title: CATEGORY_LABELS[cat] ?? cat,
          data: buildRows(grouped[cat]),
        }));

      // Append any uncategorized items
      if (grouped['other']?.length > 0) {
        built.push({
          key: 'other',
          title: 'Other',
          data: buildRows(grouped['other']),
        });
      }

      setSections(built);
    } catch (err) {
      if (__DEV__) console.warn('[Favorites] load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleItemPress = useCallback(
    (item: WardrobeItemResponse) => {
      navigation.navigate('ClosetItemDetail', {
        itemId: item.id ?? '',
        frontImageUrl: item.cleanImageUrl ?? '',
        backImageUrl: item.backImageUrl ?? undefined,
        itemName: item.clothingType ?? item.category ?? item.type ?? 'Item',
        isFavorite: item.isFavorite,
      });
    },
    [navigation]
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#C4A882" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color="#2C1A0E" />
          </Pressable>
          <Text style={styles.title}>FAVORITES</Text>
        </View>
        <Text style={styles.subtitle}>
          {totalCount === 1 ? '1 favourite item' : `${totalCount} favourite items`} across your closet
        </Text>
        <View style={styles.separator} />
      </View>

      {sections.length === 0 ? (
        <EmptyState />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(row, i) => `${row.left.id ?? i}`}
          renderSectionHeader={({ section }) => (
            <SectionHeader
              title={section.title}
              count={section.data.reduce(
                (acc, r) => acc + 1 + (r.right ? 1 : 0),
                0
              )}
            />
          )}
          renderItem={({ item: row }) => (
            <View style={styles.row}>
              <FavoriteItemCard
                item={row.left}
                onPress={() => handleItemPress(row.left)}
              />
              {row.right ? (
                <FavoriteItemCard
                  item={row.right}
                  onPress={() => handleItemPress(row.right!)}
                />
              ) : (
                <View style={{ width: CARD_SIZE }} />
              )}
            </View>
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          stickySectionHeaders={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2EBE0',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F2EBE0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingTop: 8,
    paddingBottom: 4,
    paddingHorizontal: H_PADDING,
    backgroundColor: '#F2EBE0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#EDE6D8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#2C1A0E',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: '#8C7B6B',
    marginTop: 2,
    marginBottom: 12,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(196,168,130,0.3)',
  },
  list: {
    paddingHorizontal: H_PADDING,
    paddingBottom: 40,
  },
  row: {
    flexDirection: 'row',
    gap: COLUMN_GAP,
  },
});
