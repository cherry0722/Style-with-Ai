/**
 * ClosetItemDetailScreen — full-screen front/back image viewer.
 * Receives frontImageUrl, backImageUrl (optional), and itemName via route params.
 * Swipe left/right to toggle front ↔ back (disabled if no back image).
 */
import React, { useRef, useState } from 'react';
import {
  View,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Text,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/RootNavigator';

type DetailRoute = RouteProp<RootStackParamList, 'ClosetItemDetail'>;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });

export default function ClosetItemDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<DetailRoute>();
  const { frontImageUrl, backImageUrl, itemName } = route.params;

  const hasBack = !!backImageUrl;
  const images: string[] = hasBack ? [frontImageUrl, backImageUrl!] : [frontImageUrl];
  const labels: string[] = hasBack ? ['Front', 'Back'] : ['Front'];

  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleMomentumScrollEnd = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setActiveIndex(idx);
  };

  return (
    <View style={styles.container}>
      {/* ── Top bar ─────────────────────────────────────────── */}
      <SafeAreaView edges={['top']} style={styles.topSafe}>
        <View style={styles.topBar}>
          <Text style={styles.itemNameText} numberOfLines={1}>{itemName}</Text>
          <Pressable
            style={styles.closeBtn}
            onPress={() => navigation.goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={22} color="#F5F0E8" />
          </Pressable>
        </View>
      </SafeAreaView>

      {/* ── Image pager ─────────────────────────────────────── */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={hasBack}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        bounces={false}
        style={styles.pager}
      >
        {images.map((uri, idx) => (
          <View key={`img-${idx}`} style={styles.page}>
            <Image
              source={{ uri }}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        ))}
      </ScrollView>

      {/* ── Bottom indicator ────────────────────────────────── */}
      <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
        <View style={styles.bottomBar}>
          {/* Label pill */}
          <View style={styles.labelPill}>
            <Text style={styles.labelText}>{labels[activeIndex]}</Text>
          </View>

          {/* Dots — only shown when back image is present */}
          {hasBack && (
            <View style={styles.dotsRow}>
              {images.map((_, idx) => (
                <View
                  key={`dot-${idx}`}
                  style={[styles.dot, idx === activeIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}

          {/* Swipe hint — shown only when back is available and on front page */}
          {hasBack && activeIndex === 0 && (
            <Text style={styles.swipeHint}>Swipe to see back</Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1611',
  },

  // ── Top bar ────────────────────────────────────────────────
  topSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(26, 22, 17, 0.85)',
  },
  itemNameText: {
    flex: 1,
    fontFamily: SERIF,
    fontSize: 18,
    fontWeight: '700',
    color: '#F5F0E8',
    letterSpacing: -0.3,
    marginRight: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Pager ─────────────────────────────────────────────────
  pager: {
    flex: 1,
  },
  page: {
    width: SCREEN_W,
    height: SCREEN_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_W,
    height: SCREEN_H,
  },

  // ── Bottom bar ────────────────────────────────────────────
  bottomSafe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: 20,
    paddingTop: 12,
    gap: 8,
    backgroundColor: 'rgba(26, 22, 17, 0.75)',
  },
  labelPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(196, 168, 130, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(196, 168, 130, 0.40)',
  },
  labelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C4A882',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(245, 240, 232, 0.35)',
  },
  dotActive: {
    backgroundColor: '#C4A882',
    width: 18,
  },
  swipeHint: {
    fontSize: 12,
    color: 'rgba(245, 240, 232, 0.50)',
    letterSpacing: 0.3,
  },
});
