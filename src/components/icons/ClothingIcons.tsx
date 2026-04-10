/**
 * Custom View-based clothing icons for categories that have no suitable
 * glyph in any bundled icon font.  Pure React Native Views — zero
 * dependencies, renders identically on iOS 18.6 and iOS 26.
 *
 * Props mirror the Ionicons component interface (size, color, style)
 * so call-sites can swap between Ionicons and these seamlessly.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

interface ClothingIconProps {
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

// ─── Hoodie ──────────────────────────────────────────────────────────────────
// Dome hood on top, wider rectangular body, small rounded sleeves.

export function HoodieIcon({ size = 24, color = '#000', style }: ClothingIconProps) {
  const hoodW = size * 0.38;
  const hoodH = size * 0.22;
  const bodyW = size * 0.60;
  const bodyH = size * 0.48;
  const sleeveW = size * 0.12;
  const sleeveH = size * 0.28;

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      {/* Hood dome */}
      <View
        style={{
          width: hoodW,
          height: hoodH,
          borderTopLeftRadius: hoodW / 2,
          borderTopRightRadius: hoodW / 2,
          backgroundColor: color,
          marginBottom: -1,
        }}
      />
      {/* Body + sleeves */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View
          style={{
            width: sleeveW,
            height: sleeveH,
            borderRadius: sleeveW / 2,
            backgroundColor: color,
            marginTop: size * 0.01,
            marginRight: -1,
          }}
        />
        <View
          style={{
            width: bodyW,
            height: bodyH,
            borderBottomLeftRadius: size * 0.04,
            borderBottomRightRadius: size * 0.04,
            backgroundColor: color,
          }}
        />
        <View
          style={{
            width: sleeveW,
            height: sleeveH,
            borderRadius: sleeveW / 2,
            backgroundColor: color,
            marginTop: size * 0.01,
            marginLeft: -1,
          }}
        />
      </View>
    </View>
  );
}

// ─── Pants ───────────────────────────────────────────────────────────────────
// Waistband on top, two parallel legs below with a small gap.

export function PantsIcon({ size = 24, color = '#000', style }: ClothingIconProps) {
  const totalW = size * 0.55;
  const waistH = size * 0.18;
  const legGap = size * 0.07;
  const legW = (totalW - legGap) / 2;
  const legH = size * 0.52;

  return (
    <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      {/* Waistband */}
      <View
        style={{
          width: totalW,
          height: waistH,
          borderTopLeftRadius: size * 0.04,
          borderTopRightRadius: size * 0.04,
          backgroundColor: color,
        }}
      />
      {/* Legs */}
      <View style={{ flexDirection: 'row', gap: legGap }}>
        <View
          style={{
            width: legW,
            height: legH,
            borderBottomLeftRadius: size * 0.04,
            borderBottomRightRadius: size * 0.04,
            backgroundColor: color,
          }}
        />
        <View
          style={{
            width: legW,
            height: legH,
            borderBottomLeftRadius: size * 0.04,
            borderBottomRightRadius: size * 0.04,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}
