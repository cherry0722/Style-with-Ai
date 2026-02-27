/**
 * Avatar tab — Coming Soon placeholder with CSS-drawn avatar character wearing glasses.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const P = {
  background:  '#F5F0E8',
  cardSurface: '#EDE6D8',
  cardWhite:   '#FFFFFF',
  primaryText: '#3D3426',
  secondary:   '#8C7E6A',
  light:       '#B5A894',
  border:      '#E8E0D0',
  accent:      '#C4A882',
  accentLight: '#E8D9C5',
  shadow:      'rgba(61, 52, 38, 0.08)',
  skin:        '#DEAD8F',
  skinDark:    '#C9956E',
  hair:        '#5C4A3A',
  pants:       '#4A5568',
  shoes:       '#F0EDE6',
} as const;

export default function ComingSoonScreen() {
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <Text style={styles.pageTitle}>AVATAR</Text>

      <View style={styles.center}>
        {/* CSS-drawn avatar with glasses */}
        <View style={styles.figure}>
          {/* Hair */}
          <View style={styles.hair}>
            <View style={styles.hairTop} />
            <View style={styles.bangLeft} />
            <View style={styles.bangRight} />
          </View>

          {/* Face */}
          <View style={styles.face}>
            {/* Ears */}
            <View style={[styles.ear, styles.earLeft]} />
            <View style={[styles.ear, styles.earRight]} />
            {/* Glasses */}
            <View style={styles.glassesRow}>
              <View style={styles.glassLens} />
              <View style={styles.glassBridge} />
              <View style={styles.glassLens} />
            </View>
            {/* Eyes (behind glasses) */}
            <View style={styles.eyeRow}>
              <View style={styles.eye} />
              <View style={styles.eye} />
            </View>
            {/* Smile */}
            <View style={styles.smile} />
          </View>

          {/* Neck */}
          <View style={styles.neck} />

          {/* Torso */}
          <View style={styles.torso}>
            <View style={[styles.arm, styles.armLeft]}>
              <View style={styles.hand} />
            </View>
            <View style={[styles.arm, styles.armRight]}>
              <View style={styles.hand} />
            </View>
          </View>

          {/* Legs */}
          <View style={styles.legsRow}>
            <View style={styles.leg} />
            <View style={styles.leg} />
          </View>

          {/* Shoes */}
          <View style={styles.shoesRow}>
            <View style={styles.shoe} />
            <View style={styles.shoe} />
          </View>
        </View>

        {/* Coming Soon card */}
        <View style={styles.comingSoonCard}>
          <Text style={styles.comingSoonTitle}>COMING SOON</Text>
          <Text style={styles.subtitle}>This feature will be part of v2.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: P.background,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: P.primaryText,
    letterSpacing: -0.5,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
    paddingHorizontal: 32,
  },

  figure: { alignItems: 'center', marginBottom: 28 },

  hair: {
    width: 64, height: 30, position: 'relative', marginBottom: -6, zIndex: 2,
  },
  hairTop: {
    width: 64, height: 30,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    borderBottomLeftRadius: 4, borderBottomRightRadius: 4,
    backgroundColor: P.hair,
  },
  bangLeft: {
    position: 'absolute', bottom: -5, left: 2,
    width: 14, height: 16, borderBottomLeftRadius: 8, borderBottomRightRadius: 3,
    backgroundColor: P.hair,
  },
  bangRight: {
    position: 'absolute', bottom: -5, right: 2,
    width: 12, height: 12, borderBottomLeftRadius: 3, borderBottomRightRadius: 8,
    backgroundColor: P.hair,
  },

  face: {
    width: 56, height: 64, borderRadius: 28,
    backgroundColor: P.skin,
    justifyContent: 'center', alignItems: 'center',
    zIndex: 1, overflow: 'visible',
  },
  ear: {
    position: 'absolute', width: 10, height: 14, borderRadius: 5,
    backgroundColor: P.skinDark, top: 22,
  },
  earLeft:  { left: -4 },
  earRight: { right: -4 },

  glassesRow: {
    flexDirection: 'row', alignItems: 'center',
    position: 'absolute', top: 18,
  },
  glassLens: {
    width: 18, height: 14, borderRadius: 7,
    borderWidth: 2, borderColor: P.secondary,
    backgroundColor: 'transparent',
  },
  glassBridge: {
    width: 6, height: 2, backgroundColor: P.secondary,
  },

  eyeRow: { flexDirection: 'row', gap: 14, marginTop: 0 },
  eye: { width: 4, height: 4, borderRadius: 2, backgroundColor: P.primaryText },
  smile: {
    width: 12, height: 6,
    borderBottomLeftRadius: 6, borderBottomRightRadius: 6,
    borderWidth: 1.5, borderTopWidth: 0,
    borderColor: P.primaryText, backgroundColor: 'transparent',
    marginTop: 6,
  },

  neck: { width: 16, height: 8, backgroundColor: P.skinDark },

  torso: {
    width: 80, height: 70,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderBottomLeftRadius: 6, borderBottomRightRadius: 6,
    backgroundColor: P.accentLight,
    alignItems: 'center', position: 'relative', overflow: 'visible',
  },
  arm: {
    position: 'absolute', width: 18, height: 52, borderRadius: 9,
    backgroundColor: P.accentLight, top: 6,
    justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 2,
  },
  armLeft:  { left: -12 },
  armRight: { right: -12 },
  hand: { width: 12, height: 12, borderRadius: 6, backgroundColor: P.skin },

  legsRow: { flexDirection: 'row', gap: 3 },
  leg: {
    width: 22, height: 44,
    borderBottomLeftRadius: 5, borderBottomRightRadius: 5,
    backgroundColor: P.pants,
  },
  shoesRow: { flexDirection: 'row', gap: 3 },
  shoe: { width: 26, height: 10, borderRadius: 5, backgroundColor: P.shoes },

  comingSoonCard: {
    backgroundColor: P.cardWhite,
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: P.border,
    shadowColor: P.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  comingSoonTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: P.primaryText,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: P.secondary,
    textAlign: 'center',
  },
});