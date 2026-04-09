/**
 * Square wardrobe grid card — visual match to FavoritesScreen / SavedScreen item cards:
 * two-column math, image area ratio, border radius 16, accent border + shadow.
 */
import React from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Dimensions,
} from 'react-native';

/** Match FavoritesScreen / SavedScreen grid rhythm */
export const WARDROBE_GRID_GAP = 12;

export function wardrobeGridCardWidth(
  screenWidth: number,
  horizontalPadding: number,
  gap: number = WARDROBE_GRID_GAP,
): number {
  return (screenWidth - horizontalPadding * 2 - gap) / 2;
}

type Props = Readonly<{
  /** Full card width (from wardrobeGridCardWidth) */
  width: number;
  imageUri: string | null;
  title: string;
  /** Primary tap target (whole card: image + meta). Omit to disable. */
  onPress?: () => void;
  /** Optional badge row under title (e.g. laundry status) */
  badge?: React.ReactNode;
  /** Overlay on image area (e.g. laundry toggle) — separate Pressables */
  imageOverlay?: React.ReactNode;
  /** Extra row below title/badge inside meta */
  metaFooter?: React.ReactNode;
}>;

export function WardrobeSquareGridCard({
  width,
  imageUri,
  title,
  onPress,
  badge,
  imageOverlay,
  metaFooter,
}: Props) {
  const imageH = width * 0.78;

  const inner = (
    <>
      <View style={[styles.imageArea, { height: imageH }]}>
        {imageOverlay ? <View style={styles.overlayWrap}>{imageOverlay}</View> : null}
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderEmoji}>👕</Text>
          </View>
        )}
      </View>
      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={2}>
          {title}
        </Text>
        {badge}
        {metaFooter}
      </View>
    </>
  );

  return (
    <View style={[styles.container, { width }]}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [pressed && styles.pressed]}
          accessibilityRole="button"
        >
          {inner}
        </Pressable>
      ) : (
        inner
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
    marginBottom: WARDROBE_GRID_GAP,
  },
  pressed: {
    opacity: 0.88,
  },
  imageArea: {
    width: '100%',
    backgroundColor: '#F7F2EC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  overlayWrap: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
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
  placeholderEmoji: {
    fontSize: 40,
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
