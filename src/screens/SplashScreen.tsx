/**
 * SplashScreen (v2) — editorial, image-backed splash.
 *
 * Fades in a full-screen hero photograph with a dark gradient overlay and
 * the MYRA masthead, then fades out and navigates to the Auth screen.
 *
 * Navigation integration: registered as the initial unauthenticated route
 * in RootNavigator; calls navigation.replace('Auth') when the timeline
 * completes. Auth screens and logic are untouched.
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  ImageBackground,
  StatusBar,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

const heroImage = require('../../assets/models/images/splash-hero.png');

const FONT_SERIF = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});
const FONT_SERIF_ITALIC = Platform.select({
  ios: 'Georgia-Italic',
  android: 'serif',
  default: 'serif',
});

// ─────────────────────────────────────────────────────────────────────────
// PulsingDot — staggered opacity pulse
// ─────────────────────────────────────────────────────────────────────────
type PulsingDotProps = { delay: number };

function PulsingDot({ delay }: PulsingDotProps) {
  const anim = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 400,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.2,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [anim, delay]);

  return <Animated.View style={[styles.dot, { opacity: anim }]} />;
}

// ─────────────────────────────────────────────────────────────────────────
// SplashScreen
// ─────────────────────────────────────────────────────────────────────────
export default function SplashScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const lineAnim = useRef(new Animated.Value(0)).current;
  const loaderAnim = useRef(new Animated.Value(0)).current;
  const fadeOutAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    // 0ms: screen fades in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    // 500ms: MYRA title fades in + slides down
    timers.push(
      setTimeout(() => {
        Animated.timing(titleAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }).start();
      }, 500),
    );

    // 1000ms: subtitle fades in
    timers.push(
      setTimeout(() => {
        Animated.timing(subtitleAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 1000),
    );

    // 1400ms: gold line + tagline fade in
    timers.push(
      setTimeout(() => {
        Animated.timing(lineAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }, 1400),
    );

    // 1800ms: loader dots fade in
    timers.push(
      setTimeout(() => {
        Animated.timing(loaderAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }, 1800),
    );

    // 3300ms: everything fades out
    timers.push(
      setTimeout(() => {
        Animated.timing(fadeOutAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }).start();
      }, 3300),
    );

    // 3900ms: navigate to Auth
    timers.push(
      setTimeout(() => {
        navigation.replace('Auth');
      }, 3900),
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [navigation, fadeAnim, titleAnim, subtitleAnim, lineAnim, loaderAnim, fadeOutAnim]);

  const titleTranslateY = titleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-12, 0],
  });

  return (
    <Animated.View style={[styles.root, { opacity: fadeOutAnim }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.View style={[styles.fill, { opacity: fadeAnim }]}>
        <ImageBackground
          source={heroImage}
          // `resizeMode` on the inner <Image> is the authoritative prop for
          // ImageBackground — the outer style is applied to the wrapping
          // View, while `imageStyle` targets the Image node directly. Setting
          // it both here and via `imageStyle` guarantees "cover" fill on all
          // RN versions/platforms and prevents the image from falling back
          // to its intrinsic pixel dimensions (which was producing the
          // stacked "horizontal lines" tiling effect on-device).
          resizeMode="cover"
          style={styles.imageBg}
          imageStyle={styles.imageBgImage}
        >
          {/*
            Real LinearGradient overlays (replacing the previous four stacked
            solid-rgba Views, which produced visible rectangular bands). Two
            gradients — top darkens for the MYRA masthead, bottom darkens for
            the loader — rendered above the image but below text content so
            the type still sits on top crisply. pointerEvents="none" keeps
            them purely decorative.
          */}
          <LinearGradient
            colors={['rgba(10,8,5,0.75)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.gradientTop}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', 'rgba(10,8,5,0.85)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.gradientBottom}
            pointerEvents="none"
          />

          {/* ── Top content ─────────────────────────────────────────── */}
          <View style={styles.topContent} pointerEvents="none">
            <Animated.Text style={[styles.subtitle, { opacity: subtitleAnim }]}>
              YOUR PERSONAL STYLE ASSISTANT
            </Animated.Text>

            <Animated.Text
              style={[
                styles.title,
                {
                  opacity: titleAnim,
                  transform: [{ translateY: titleTranslateY }],
                },
              ]}
            >
              MYRA
            </Animated.Text>

            <Animated.View style={[styles.shimmerLine, { opacity: lineAnim }]} />

            <Animated.Text style={[styles.tagline, { opacity: lineAnim }]}>
              Dress with intention
            </Animated.Text>
          </View>

          {/* ── Bottom content ──────────────────────────────────────── */}
          <Animated.View
            style={[styles.bottomContent, { opacity: loaderAnim }]}
            pointerEvents="none"
          >
            <View style={styles.dotsRow}>
              <PulsingDot delay={0} />
              <PulsingDot delay={200} />
              <PulsingDot delay={400} />
            </View>
            <Text style={styles.loadingText}>STYLING YOUR EXPERIENCE</Text>
          </Animated.View>
        </ImageBackground>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0805',
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  // ImageBackground — the wrapping View. Must be a real, flex-filled layout
  // box (NOT position: absolute with 0 bounds) so the inner <Image> receives
  // concrete width/height constraints from layout and renders "cover" once,
  // edge-to-edge, instead of falling back to its intrinsic pixel dimensions
  // stacked vertically (the "horizontal lines" artifact).
  imageBg: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  // ImageBackground — the inner <Image>. Setting resizeMode here via style
  // is the authoritative way on modern RN; pairs with the `resizeMode` prop
  // on the component itself to be safe across versions.
  imageBgImage: {
    resizeMode: 'cover',
    width: '100%',
    height: '100%',
  },

  // Real gradient overlays — replace the previous four solid-rgba bands.
  gradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: '55%',
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: '40%',
  },

  // Top content at ~18% from top
  topContent: {
    position: 'absolute',
    top: '18%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 5,
    color: 'rgba(196,168,130,0.8)',
    textTransform: 'uppercase',
    marginBottom: 18,
  },
  title: {
    fontFamily: FONT_SERIF,
    fontSize: 64,
    fontWeight: '300',
    color: '#FFFFFF',
    letterSpacing: 10,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
    marginBottom: 22,
    // Compensate for letter-spacing visually centering the glyphs
    paddingLeft: 10,
  },
  shimmerLine: {
    width: 48,
    height: 1.5,
    backgroundColor: '#C4A882',
    alignSelf: 'center',
    marginBottom: 18,
  },
  tagline: {
    fontFamily: FONT_SERIF_ITALIC,
    fontSize: 15,
    fontWeight: '400',
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
  },

  // Bottom content ~80px from bottom
  bottomContent: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C4A882',
    marginHorizontal: 4,
  },
  loadingText: {
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
  },
});
