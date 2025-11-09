import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { theme } from '../theme';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  // Animation values
  const backgroundOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoRotation = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(30)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineTranslateY = useRef(new Animated.Value(20)).current;
  const particlesOpacity = useRef(new Animated.Value(0)).current;
  const particlesScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startAnimations = () => {
      // Background fade in
      Animated.timing(backgroundOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      // Particles animation
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(particlesOpacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(particlesScale, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]).start();
      }, 200);

      // Logo animation with rotation
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(logoScale, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(logoRotation, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]).start();
      }, 600);

      // Brand name animation
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(textTranslateY, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ]).start();
      }, 1200);

      // Tagline animation
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(taglineOpacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(taglineTranslateY, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start();
      }, 1600);

      // Navigate to main app after animation completes
      setTimeout(() => {
        navigation.replace('Main');
      }, 4000);
    };

    startAnimations();
  }, [navigation, backgroundOpacity, logoScale, logoOpacity, logoRotation, textOpacity, textTranslateY, taglineOpacity, taglineTranslateY, particlesOpacity, particlesScale]);

  const logoRotationInterpolate = logoRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: backgroundOpacity }]}>
        {/* Fashion gradient background */}
        <View style={styles.backgroundGradient} />

        {/* Animated fashion elements */}
        <Animated.View style={[styles.fashionElementsContainer, { opacity: particlesOpacity }]}>
          {[...Array(15)].map((_, index) => (
            <Animated.View
              key={index}
              style={[
                styles.fashionElement,
                {
                  left: Math.random() * width,
                  top: Math.random() * height,
                  transform: [{ scale: particlesScale }],
                },
              ]}
            >
              <Text style={styles.fashionEmoji}>
                {['👗', '👠', '👜', '💄', '💍', '👑', '🕶️', '🧥', '👔', '👖'][index % 10]}
              </Text>
            </Animated.View>
          ))}
        </Animated.View>
      
      {/* Main content */}
      <View style={styles.contentContainer}>
        {/* Logo with premium styling */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              transform: [
                { scale: logoScale },
                { rotate: logoRotationInterpolate },
              ],
              opacity: logoOpacity,
            },
          ]}
        >
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>M</Text>
          </View>
          <View style={styles.logoGlow} />
        </Animated.View>
        
        {/* Brand name with premium typography */}
        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
            },
          ]}
        >
          <Text style={styles.brandName}>MYRA</Text>
        </Animated.View>
        
        {/* Tagline */}
        <Animated.View
          style={[
            styles.taglineContainer,
            {
              opacity: taglineOpacity,
              transform: [{ translateY: taglineTranslateY }],
            },
          ]}
        >
                <Text style={styles.tagline}>Your Personal Style Assistant</Text>
                <Text style={styles.subTagline}>Fashion Forward, Always</Text>
        </Animated.View>
      </View>
      
      {/* Premium loading indicator */}
      <View style={styles.loadingContainer}>
        <View style={styles.loadingBar}>
          <Animated.View style={[styles.loadingProgress, { width: '100%' }]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  fashionElementsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fashionElement: {
    position: 'absolute',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.7,
  },
  fashionEmoji: {
    fontSize: 24,
    textAlign: 'center',
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ffffff',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 20,
  },
  logoGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#ffffff',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 30,
  },
  logoText: {
    fontSize: 56,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -3,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: theme.spacing['3xl'],
  },
  brandName: {
    fontSize: 48,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 8,
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  taglineContainer: {
    alignItems: 'center',
    marginTop: theme.spacing['2xl'],
  },
  tagline: {
    fontSize: theme.typography.lg,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 1,
    opacity: 0.9,
  },
  subTagline: {
    fontSize: theme.typography.base,
    color: '#ffffff',
    fontWeight: '400',
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    opacity: 0.7,
    letterSpacing: 0.5,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: height * 0.1,
    left: theme.spacing.xl,
    right: theme.spacing.xl,
  },
  loadingBar: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingProgress: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
});
