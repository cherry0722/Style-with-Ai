import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Alert,
  ActivityIndicator,
  Dimensions,
  StatusBar,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSavedOutfits } from '../store/savedOutfits';
import { SavedOutfitItem } from '../api/saved';

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMN_GAP = 12;
const H_PADDING = 16;
const CARD_SIZE = (SCREEN_WIDTH - H_PADDING * 2 - COLUMN_GAP) / 2;
const CARD_HEIGHT = CARD_SIZE * 1.2;
const IMAGE_AREA_HEIGHT = CARD_HEIGHT * 0.68;

// ── Palette ──────────────────────────────────────────────────────────────────
const P = {
  screenBg:    '#F2EBE0',
  cardBg:      '#FFFFFF',
  imageBg:     '#F7F2EC',
  primaryText: '#2C1A0E',
  secondary:   '#8C7B6B',
  accent:      '#C4A882',
  border:      'rgba(196,168,130,0.2)',
  separator:   'rgba(196,168,130,0.25)',
  badgeBg:     '#F2EBE0',
  badgeBorder: 'rgba(196,168,130,0.4)',
} as const;

// ── Clothing image preview ───────────────────────────────────────────────────

function ClothingImagePreview({ items }: { items: SavedOutfitItem['items'] }) {
  const topItem    = items[0] as any;
  const bottomItem = items[1] as any;
  const topUri: string | null    = topItem?.cleanImageUrl    ?? topItem?.imageUrl    ?? null;
  const bottomUri: string | null = bottomItem?.cleanImageUrl ?? bottomItem?.imageUrl ?? null;

  return (
    <View style={img.container}>
      {/* Left: top garment */}
      <View style={img.half}>
        {topUri ? (
          <Image source={{ uri: topUri }} style={img.image} resizeMode="contain" />
        ) : (
          <View style={img.placeholder}>
            <Text style={img.placeholderText}>👕</Text>
          </View>
        )}
      </View>

      {/* Vertical divider */}
      <View style={img.divider} />

      {/* Right: bottom garment */}
      <View style={img.half}>
        {bottomUri ? (
          <Image source={{ uri: bottomUri }} style={img.image} resizeMode="contain" />
        ) : (
          <View style={img.placeholder}>
            <Text style={img.placeholderText}>👖</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const img = StyleSheet.create({
  container: {
    height: IMAGE_AREA_HEIGHT,
    flexDirection: 'row',
    backgroundColor: P.imageBg,
  },
  half: {
    flex: 1,
    backgroundColor: P.imageBg,
    padding: 6,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 28,
    opacity: 0.45,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: P.border,
    marginVertical: 8,
  },
});

// ── Card ────────────────────────────────────────────────────────────────────

interface CardProps {
  outfit: SavedOutfitItem;
  onPress: () => void;
  onLongPress: () => void;
}

function SavedOutfitCard({ outfit, onPress, onLongPress }: CardProps) {
  const itemLabels = outfit.items
    .map(i => (i as any).type ?? (i as any).category ?? '')
    .filter(Boolean)
    .slice(0, 2)
    .join(' · ');

  return (
    <TouchableOpacity
      style={card.container}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={500}
      activeOpacity={0.88}
    >
      <ClothingImagePreview items={outfit.items} />

      {/* Meta */}
      <View style={card.meta}>
        {outfit.occasion ? (
          <View style={card.badge}>
            <Text style={card.badgeText} numberOfLines={1}>
              {outfit.occasion}
            </Text>
          </View>
        ) : null}
        {itemLabels ? (
          <Text style={card.itemLabels} numberOfLines={1}>
            {itemLabels}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const card = StyleSheet.create({
  container: {
    width: CARD_SIZE,
    height: CARD_HEIGHT,
    backgroundColor: P.cardBg,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: P.border,
    shadowColor: '#2C1A0E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  meta: {
    flex: 1,
    backgroundColor: P.cardBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: P.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: P.badgeBg,
    borderWidth: 1,
    borderColor: P.badgeBorder,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: P.accent,
    textTransform: 'capitalize',
    letterSpacing: 0.2,
  },
  itemLabels: {
    fontSize: 10,
    color: P.secondary,
    letterSpacing: 0.1,
  },
});

// ── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <View style={empty.container}>
      <Text style={empty.icon}>⭐</Text>
      <Text style={empty.title}>No saved outfits yet</Text>
      <Text style={empty.subtitle}>
        Tap the star while viewing an outfit to save it here
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
    gap: 12,
    backgroundColor: P.screenBg,
  },
  icon: { fontSize: 48 },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: P.primaryText,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: P.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

// ── Screen ───────────────────────────────────────────────────────────────────

export default function SavedScreen() {
  const navigation = useNavigation<any>();
  const { items, loading, fetchAll, remove } = useSavedOutfits();

  useEffect(() => {
    fetchAll().catch(err => {
      if (__DEV__) console.warn('[SavedScreen] fetchAll error:', err);
    });
  }, []);

  const handlePress = useCallback(
    (outfit: SavedOutfitItem) => {
      navigation.navigate('Avatar3DScreen', { savedOutfit: outfit });
    },
    [navigation]
  );

  const handleLongPress = useCallback(
    (outfit: SavedOutfitItem) => {
      Alert.alert(
        'Remove outfit',
        'Remove this outfit from your saved collection?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              remove(outfit._id).catch(err => {
                if (__DEV__) console.warn('[SavedScreen] remove error:', err);
              });
            },
          },
        ]
      );
    },
    [remove]
  );

  const renderItem = useCallback(
    ({ item }: { item: SavedOutfitItem }) => (
      <SavedOutfitCard
        outfit={item}
        onPress={() => handlePress(item)}
        onLongPress={() => handleLongPress(item)}
      />
    ),
    [handlePress, handleLongPress]
  );

  if (loading && items.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={P.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={P.primaryText} />
          </Pressable>
          <Text style={styles.title}>SAVED OUTFITS</Text>
        </View>
        <Text style={styles.subtitle}>Long press a card to remove</Text>
        <View style={styles.separator} />
      </View>
      <FlatList
        data={items}
        keyExtractor={i => i._id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[
          styles.list,
          items.length === 0 && styles.listEmpty,
        ]}
        ListEmptyComponent={<EmptyState />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: P.screenBg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: P.screenBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingTop: 8,
    paddingBottom: 14,
    paddingHorizontal: H_PADDING,
    backgroundColor: P.screenBg,
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
    color: P.primaryText,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: P.secondary,
    marginTop: 3,
    marginBottom: 14,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(196,168,130,0.3)',
  },
  list: {
    padding: H_PADDING,
    paddingTop: 16,
    gap: COLUMN_GAP,
  },
  listEmpty: {
    flex: 1,
  },
  row: {
    gap: COLUMN_GAP,
    marginBottom: COLUMN_GAP,
  },
});
