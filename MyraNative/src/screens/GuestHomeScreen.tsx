/**
 * GuestHomeScreen — read-only preview of the MYRA Home layout.
 * No protected API calls. Every interactive element redirects to Auth.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

const H_PAD = 24;
const HEADER_H = 56;
const GRID_GAP = 10;
const BOTTOM_RESERVE = 40;

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
  skin:          '#DEAD8F',
  skinDark:      '#C9956E',
  hair:          '#5C4A3A',
  pants:         '#4A5568',
  shoes:         '#F0EDE6',
} as const;

const CARD_SHADOW = {
  shadowColor: P.shadow,
  shadowOpacity: 1,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });

function PillBtn({ children, onPress, style }: Readonly<{ children: React.ReactNode; onPress: () => void; style?: object }>) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pillBtn, style, pressed && { opacity: 0.7 }]}
      hitSlop={6}
      accessibilityRole="button"
    >
      {children}
    </Pressable>
  );
}

function AvatarFigure() {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -6, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0,  duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim]);

  return (
    <View style={avatarStyles.wrapper}>
      <View style={avatarStyles.glow} />
      <Animated.View style={[avatarStyles.figure, { transform: [{ translateY: floatAnim }] }]}>
        <View style={avatarStyles.hair}>
          <View style={avatarStyles.hairTop} />
          <View style={avatarStyles.bangLeft} />
          <View style={avatarStyles.bangRight} />
        </View>
        <View style={avatarStyles.face}>
          <View style={[avatarStyles.ear, avatarStyles.earLeft]} />
          <View style={[avatarStyles.ear, avatarStyles.earRight]} />
          <View style={avatarStyles.eyeRow}>
            <View style={avatarStyles.eye} />
            <View style={avatarStyles.eye} />
          </View>
          <View style={avatarStyles.smile} />
        </View>
        <View style={avatarStyles.neck} />
        <View style={avatarStyles.torso}>
          <View style={avatarStyles.collarV}>
            <View style={avatarStyles.collarLeft} />
            <View style={avatarStyles.collarRight} />
          </View>
          <View style={[avatarStyles.arm, avatarStyles.armLeft]}><View style={avatarStyles.hand} /></View>
          <View style={[avatarStyles.arm, avatarStyles.armRight]}><View style={avatarStyles.hand} /></View>
        </View>
        <View style={avatarStyles.legsRow}>
          <View style={avatarStyles.leg} />
          <View style={avatarStyles.leg} />
        </View>
        <View style={avatarStyles.shoesRow}>
          <View style={avatarStyles.shoe} />
          <View style={avatarStyles.shoe} />
        </View>
      </Animated.View>
    </View>
  );
}

function InfoCard({ width, children }: Readonly<{ width: number; children: React.ReactNode }>) {
  return <View style={[styles.infoCard, { width }, CARD_SHADOW]}>{children}</View>;
}

export default function GuestHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();

  const { width: screenW, height: screenH } = Dimensions.get('window');
  const containerW = screenW - H_PAD * 2;
  const avatarH    = Math.max(280, Math.min(screenH * 0.48, 440));
  const infoCardW  = (containerW - GRID_GAP * 2) / 3;
  const bottomPad  = BOTTOM_RESERVE + (insets?.bottom ?? 0);

  const goAuth = () => navigation.navigate('Auth');

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: H_PAD, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.headerRow, { height: HEADER_H }]}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>HOME</Text>
            <Text style={styles.headerEmoji}> 🏠</Text>
          </View>
          <View style={styles.headerRight}>
            <PillBtn onPress={() => {}} style={styles.pillGap}>
              <Text style={styles.pillEmoji}>☀️</Text>
              <Text style={styles.pillText}>72°</Text>
            </PillBtn>
            <PillBtn onPress={goAuth} style={styles.pillGap}>
              <Text style={styles.pillEmoji}>📅</Text>
            </PillBtn>
            <PillBtn onPress={goAuth} style={styles.pillGap}>
              <Text style={styles.pillEmoji}>👔</Text>
            </PillBtn>
            <PillBtn onPress={goAuth}>
              <Text style={styles.pillEmoji}>👤</Text>
            </PillBtn>
          </View>
        </View>

        {/* Avatar */}
        <View style={[styles.avatarArea, { height: avatarH }]}>
          <AvatarFigure />
        </View>

        {/* CTA — redirects to Auth */}
        <Pressable
          style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.85 }]}
          onPress={goAuth}
        >
          <Text style={styles.ctaBtnText}>PLAN MY OUTFIT OF THE DAY</Text>
          <View style={styles.ctaIcons}>
            <Text style={styles.ctaEmoji}>👔</Text>
            <Text style={styles.ctaEmoji}>✨</Text>
          </View>
        </Pressable>

        {/* Info cards */}
        <View style={styles.infoRow}>
          <InfoCard width={infoCardW}>
            <Text style={styles.infoEmoji}>☁️</Text>
            <Text style={styles.infoValue}>72°F</Text>
            <Text style={styles.infoLabel} numberOfLines={1}>Clear</Text>
            <Text style={styles.infoMeta}>Today</Text>
          </InfoCard>

          <Pressable onPress={goAuth} style={{ width: infoCardW }}>
            <InfoCard width={infoCardW}>
              <Text style={styles.infoTitle}>IN LAUNDRY</Text>
              <Text style={styles.infoValue}>—</Text>
              <Text style={styles.infoMeta}>items</Text>
            </InfoCard>
          </Pressable>

          <InfoCard width={infoCardW}>
            <View style={styles.factHeader}>
              <Text style={styles.infoTitle}>Fashion Fact</Text>
              <Text style={styles.factSparkle}>✨</Text>
            </View>
            <Text style={styles.infoFact}>Neutral tones pair with any accent.</Text>
          </InfoCard>
        </View>

        {/* Sign-in banner */}
        <Pressable style={styles.signInBanner} onPress={goAuth}>
          <Text style={styles.signInText}>Sign in to unlock your personalised wardrobe</Text>
          <Text style={styles.signInArrow}>→</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const avatarStyles = StyleSheet.create({
  wrapper:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  glow:       { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: `${P.accentLight}54`, alignSelf: 'center' },
  figure:     { alignItems: 'center' },
  hair:       { width: 72, height: 34, position: 'relative', marginBottom: -8, zIndex: 2 },
  hairTop:    { width: 72, height: 34, borderTopLeftRadius: 36, borderTopRightRadius: 36, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, backgroundColor: P.hair },
  bangLeft:   { position: 'absolute', bottom: -6, left: 2, width: 16, height: 18, borderBottomLeftRadius: 10, borderBottomRightRadius: 4, backgroundColor: P.hair },
  bangRight:  { position: 'absolute', bottom: -6, right: 2, width: 14, height: 14, borderBottomLeftRadius: 4, borderBottomRightRadius: 10, backgroundColor: P.hair },
  face:       { width: 64, height: 72, borderRadius: 32, backgroundColor: P.skin, justifyContent: 'center', alignItems: 'center', zIndex: 1, overflow: 'visible' },
  ear:        { position: 'absolute', width: 12, height: 16, borderRadius: 6, backgroundColor: P.skinDark, top: 26 },
  earLeft:    { left: -5 },
  earRight:   { right: -5 },
  eyeRow:     { flexDirection: 'row', gap: 16, marginTop: 4 },
  eye:        { width: 6, height: 6, borderRadius: 3, backgroundColor: P.primaryText },
  smile:      { width: 14, height: 7, borderBottomLeftRadius: 7, borderBottomRightRadius: 7, borderWidth: 2, borderTopWidth: 0, borderColor: P.primaryText, backgroundColor: 'transparent', marginTop: 8 },
  neck:       { width: 18, height: 10, backgroundColor: P.skinDark, zIndex: 0 },
  torso:      { width: 90, height: 80, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: P.accentLight, alignItems: 'center', position: 'relative', overflow: 'visible' },
  collarV:    { flexDirection: 'row', justifyContent: 'center', marginTop: 2 },
  collarLeft: { width: 14, height: 14, borderBottomRightRadius: 14, borderRightWidth: 2, borderBottomWidth: 2, borderColor: P.accent, backgroundColor: 'transparent', transform: [{ rotate: '15deg' }], marginRight: -2 },
  collarRight:{ width: 14, height: 14, borderBottomLeftRadius: 14, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: P.accent, backgroundColor: 'transparent', transform: [{ rotate: '-15deg' }], marginLeft: -2 },
  arm:        { position: 'absolute', width: 20, height: 60, borderRadius: 10, backgroundColor: P.accentLight, top: 6, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 2 },
  armLeft:    { left: -14 },
  armRight:   { right: -14 },
  hand:       { width: 14, height: 14, borderRadius: 7, backgroundColor: P.skin },
  legsRow:    { flexDirection: 'row', gap: 4, marginTop: 0 },
  leg:        { width: 24, height: 52, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, backgroundColor: P.pants },
  shoesRow:   { flexDirection: 'row', gap: 4, marginTop: 0 },
  shoe:       { width: 28, height: 12, borderRadius: 6, backgroundColor: P.shoes },
});

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: P.background },

  headerRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle:{ fontFamily: SERIF, fontSize: 30, fontWeight: '700', color: P.primaryText, letterSpacing: -0.5 },
  headerEmoji:{ fontSize: 22, marginLeft: 4 },
  headerRight:{ flexDirection: 'row', alignItems: 'center' },

  pillBtn:    { flexDirection: 'row', alignItems: 'center', height: 34, paddingHorizontal: 10, borderRadius: 14, backgroundColor: P.cardWhite, borderWidth: 1, borderColor: P.border, shadowColor: P.shadow, shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1, gap: 3 },
  pillGap:    { marginRight: 6 },
  pillEmoji:  { fontSize: 15 },
  pillText:   { fontSize: 13, fontWeight: '600', color: P.primaryText },

  avatarArea: { alignSelf: 'center', width: '100%', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },

  ctaBtn:     { width: '100%', height: 54, backgroundColor: P.cardWhite, borderRadius: 18, borderWidth: 1, borderColor: P.border, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 14, shadowColor: P.shadow, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  ctaBtnText: { fontSize: 14, fontWeight: '700', color: P.primaryText, letterSpacing: 1.2, textTransform: 'uppercase' },
  ctaIcons:   { flexDirection: 'row', marginLeft: 10, gap: 2 },
  ctaEmoji:   { fontSize: 16 },

  infoRow:    { flexDirection: 'row', gap: GRID_GAP, marginBottom: 16 },
  infoCard:   { backgroundColor: P.cardSurface, borderRadius: 16, borderWidth: 1, borderColor: P.border, padding: 12, justifyContent: 'center', alignItems: 'center', minHeight: 110 },
  infoEmoji:  { fontSize: 20, marginBottom: 2 },
  infoTitle:  { fontSize: 10, fontWeight: '700', color: P.secondaryText, letterSpacing: 0.5, marginBottom: 4, textAlign: 'center' },
  infoValue:  { fontSize: 18, fontWeight: '700', color: P.primaryText, marginTop: 2 },
  infoLabel:  { fontSize: 11, color: P.secondaryText, marginTop: 2 },
  infoMeta:   { fontSize: 10, color: P.lightText, marginTop: 2 },
  factHeader: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  factSparkle:{ fontSize: 10 },
  infoFact:   { fontSize: 10, color: P.secondaryText, marginTop: 4, textAlign: 'center', lineHeight: 14 },

  signInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: P.accent,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  signInText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', flex: 1, marginRight: 8 },
  signInArrow:{ fontSize: 18, color: '#FFFFFF' },
});
