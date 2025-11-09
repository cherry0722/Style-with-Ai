import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
  AccessibilityInfo,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../context/ThemeContext';
import SignInForm from '../components/auth/SignInForm';
import SocialButtons from '../components/auth/SocialButtons';
import { hapticFeedback } from '../utils/haptics';

const { width, height } = Dimensions.get('window');

// Placeholder assets - TODO: Replace with actual assets
// const FASHION_VIDEO = require('../assets/video/fashion_shades.mp4'); // TODO: Add video
// const TOP_HERO_IMAGE = require('../assets/images/topHero.png'); // TODO: Add image
// const BOTTOM_HERO_IMAGE = require('../assets/images/bottomHero.png'); // TODO: Add image

interface SignInScreenProps {
  navigation?: any;
}

export default function SignInScreen({ navigation }: SignInScreenProps = {}) {
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [_isSigningIn, _setIsSigningIn] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Animation values
  const topHeroTranslateY = useSharedValue(-60);
  const bottomHeroTranslateY = useSharedValue(60);
  const topHeroOpacity = useSharedValue(0);
  const bottomHeroOpacity = useSharedValue(0);
  const formOpacity = useSharedValue(0);
  const formTranslateY = useSharedValue(30);
  const backgroundOverlayOpacity = useSharedValue(0);
  const backgroundBlur = useSharedValue(0);

  const styles = createStyles(theme);

  useEffect(() => {
    // Check for reduced motion preference
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);

    // Start entrance animations
    if (!reduceMotion) {
      startEntranceAnimations();
    } else {
      // Simple fade-in for reduced motion
      topHeroOpacity.value = withTiming(1, { duration: 300 });
      bottomHeroOpacity.value = withTiming(1, { duration: 300 });
      formOpacity.value = withTiming(1, { duration: 300 });
    }
  }, [reduceMotion]);

  const startEntranceAnimations = () => {
    // Top hero image slides down
    topHeroTranslateY.value = withSpring(0, {
      damping: 20,
      stiffness: 100,
    });
    topHeroOpacity.value = withTiming(1, { duration: 600 });

    // Bottom hero image slides up
    bottomHeroTranslateY.value = withSpring(0, {
      damping: 20,
      stiffness: 100,
    });
    bottomHeroOpacity.value = withTiming(1, { duration: 600 });

    // Form fades in with slight upward movement
    formOpacity.value = withTiming(1, { duration: 600 });
    formTranslateY.value = withSpring(0, {
      damping: 15,
      stiffness: 100,
    });
  };

  const handleSignInStart = () => {
    _setIsSigningIn(true);
    
    if (!reduceMotion) {
      // Add background overlay and blur
      backgroundOverlayOpacity.value = withTiming(0.35, { duration: 300 });
      backgroundBlur.value = withTiming(10, { duration: 300 });
    }
  };

  const handleSignInEnd = () => {
    _setIsSigningIn(false);
    
    if (!reduceMotion) {
      // Remove background overlay and blur
      backgroundOverlayOpacity.value = withTiming(0, { duration: 300 });
      backgroundBlur.value = withTiming(0, { duration: 300 });
    }
  };

  const handleSignInSuccess = () => {
    hapticFeedback.success();
    // Navigation will be handled by the auth context
  };

  const handleCreateAccount = () => {
    hapticFeedback.light();
    if (navigation) {
      navigation.navigate('Signup');
    }
  };

  // Animated styles
  const topHeroAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: topHeroTranslateY.value }],
    opacity: topHeroOpacity.value,
  }));

  const bottomHeroAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bottomHeroTranslateY.value }],
    opacity: bottomHeroOpacity.value,
  }));

  const formAnimatedStyle = useAnimatedStyle(() => ({
    opacity: formOpacity.value,
    transform: [{ translateY: formTranslateY.value }],
  }));

  const backgroundOverlayStyle = useAnimatedStyle(() => ({
    opacity: backgroundOverlayOpacity.value,
  }));

  const backgroundBlurStyle = useAnimatedStyle(() => ({
    opacity: interpolate(backgroundBlur.value, [0, 10], [0, 1]),
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Video Background */}
      <View style={styles.videoContainer}>
        {/* Placeholder for video - TODO: Replace with actual video */}
        <View style={styles.videoPlaceholder}>
          <LinearGradient
            colors={['#000000', '#1a1a1a', '#000000']}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.videoPlaceholderContent}>
            <Text style={styles.videoPlaceholderText}>🎬</Text>
            <Text style={styles.videoPlaceholderLabel}>Fashion Video Background</Text>
            <Text style={styles.videoPlaceholderSubtext}>TODO: Add fashion_shades.mp4</Text>
          </View>
        </View>
        
        {/* TODO: Uncomment when video asset is available
        <Video
          source={FASHION_VIDEO}
          style={styles.video}
          resizeMode="cover"
          shouldPlay
          isLooping
          isMuted
        />
        */}
      </View>

      {/* Background Overlay (for state transitions) */}
      <Animated.View style={[styles.backgroundOverlay, backgroundOverlayStyle]} />
      
      {/* Background Blur (for state transitions) */}
      <Animated.View style={[styles.backgroundBlur, backgroundBlurStyle]}>
        <BlurView intensity={20} style={StyleSheet.absoluteFillObject} />
      </Animated.View>

      {/* Top Hero Image */}
      <Animated.View style={[styles.topHeroContainer, topHeroAnimatedStyle]}>
        <View style={styles.heroImagePlaceholder}>
          <Text style={styles.heroPlaceholderText}>📸</Text>
          <Text style={styles.heroPlaceholderLabel}>Top Hero</Text>
        </View>
        {/* TODO: Uncomment when image asset is available
        <Image source={TOP_HERO_IMAGE} style={styles.heroImage} resizeMode="cover" />
        */}
      </Animated.View>

      {/* Bottom Hero Image */}
      <Animated.View style={[styles.bottomHeroContainer, bottomHeroAnimatedStyle]}>
        <View style={styles.heroImagePlaceholder}>
          <Text style={styles.heroPlaceholderText}>📸</Text>
          <Text style={styles.heroPlaceholderLabel}>Bottom Hero</Text>
        </View>
        {/* TODO: Uncomment when image asset is available
        <Image source={BOTTOM_HERO_IMAGE} style={styles.heroImage} resizeMode="cover" />
        */}
      </Animated.View>

      {/* Main Content */}
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Glass Card with Form */}
          <Animated.View style={[styles.glassCard, formAnimatedStyle]}>
            <LinearGradient
              colors={[
                'rgba(255, 255, 255, 0.1)',
                'rgba(255, 255, 255, 0.05)',
                'rgba(255, 255, 255, 0.1)',
              ]}
              style={styles.glassGradient}
            >
              <BlurView intensity={20} style={styles.glassBlur}>
                <View style={styles.glassContent}>
                  {/* MYRA Logo */}
                  <View style={styles.logoContainer}>
                    <View style={styles.logoCircle}>
                      <Text style={styles.logoText}>M</Text>
                    </View>
                    <View style={styles.logoGlow} />
                  </View>

                  {/* Sign In Form */}
                  <SignInForm
                    onSignInSuccess={handleSignInSuccess}
                    isLoading={isLoading}
                    onLoadingChange={(loading) => {
                      setIsLoading(loading);
                      if (loading) {
                        handleSignInStart();
                      } else {
                        handleSignInEnd();
                      }
                    }}
                  />

                  {/* Social Buttons */}
                  <SocialButtons
                    onSignInSuccess={handleSignInSuccess}
                    isLoading={isLoading}
                  />

                  {/* Create Account Link */}
                  <View style={styles.createAccountContainer}>
                    <Text style={styles.createAccountText}>Don't have an account? </Text>
                    <Pressable onPress={handleCreateAccount} disabled={isLoading}>
                      <Text style={styles.createAccountLink}>Create account</Text>
                    </Pressable>
                  </View>
                </View>
              </BlurView>
            </LinearGradient>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  videoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholderContent: {
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  videoPlaceholderText: {
    fontSize: 48,
  },
  videoPlaceholderLabel: {
    fontSize: theme.typography.lg,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
  },
  videoPlaceholderSubtext: {
    fontSize: theme.typography.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  backgroundBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topHeroContainer: {
    position: 'absolute',
    top: height * 0.1,
    left: width * 0.1,
    width: width * 0.3,
    height: height * 0.2,
    zIndex: 2,
  },
  bottomHeroContainer: {
    position: 'absolute',
    bottom: height * 0.15,
    right: width * 0.1,
    width: width * 0.3,
    height: height * 0.2,
    zIndex: 2,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    borderRadius: theme.borderRadius.xl,
    ...theme.shadows.lg,
  },
  heroImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.lg,
  },
  heroPlaceholderText: {
    fontSize: 32,
    marginBottom: theme.spacing.sm,
  },
  heroPlaceholderLabel: {
    fontSize: theme.typography.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  glassCard: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    borderRadius: theme.borderRadius['2xl'],
    overflow: 'hidden',
    ...theme.shadows.xl,
  },
  glassGradient: {
    borderRadius: theme.borderRadius['2xl'],
  },
  glassBlur: {
    borderRadius: theme.borderRadius['2xl'],
  },
  glassContent: {
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  logoContainer: {
    position: 'relative',
    alignSelf: 'center',
    marginBottom: theme.spacing.md,
  },
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.white,
  },
  logoGlow: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 33,
    backgroundColor: theme.colors.accent,
    opacity: 0.2,
    zIndex: -1,
  },
  createAccountContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  createAccountText: {
    fontSize: theme.typography.base,
    color: theme.colors.textSecondary,
  },
  createAccountLink: {
    fontSize: theme.typography.base,
    color: theme.colors.accent,
    fontWeight: 'bold',
  },
});
