import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../utils/haptics';

const { width } = Dimensions.get('window');

interface TestVideoPlayerProps {
  onVideoPress?: () => void;
}

export default function TestVideoPlayer({ onVideoPress }: TestVideoPlayerProps) {
  const theme = useTheme();
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  
  const styles = createStyles(theme);

  // Simulate video frames with fashion content
  const fashionFrames = [
    { emoji: '👗', text: 'Elegant Dresses', color: '#D4A5A5' },
    { emoji: '👠', text: 'Stylish Heels', color: '#A8B5A0' },
    { emoji: '👜', text: 'Designer Bags', color: '#C8B8D8' },
    { emoji: '👔', text: 'Professional Wear', color: '#E8D5C4' },
    { emoji: '🕶️', text: 'Fashion Accessories', color: '#F7E7CE' },
    { emoji: '👑', text: 'Luxury Items', color: '#D4A5A5' },
  ];

  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        setCurrentFrame((prev) => (prev + 1) % fashionFrames.length);
        
        // Fade animation
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0.3,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }, 2000); // Change frame every 2 seconds

      return () => clearInterval(interval);
    }
  }, [isPlaying, fadeAnim]);

  const handlePlayPause = () => {
    hapticFeedback.light();
    setIsPlaying(!isPlaying);
  };

  const handlePress = () => {
    if (onVideoPress) {
      onVideoPress();
    } else {
      handlePlayPause();
    }
  };

  const currentFashion = fashionFrames[currentFrame];

  return (
    <View style={styles.container}>
      <Pressable 
        style={styles.videoWrapper}
        onPress={handlePress}
        accessibilityLabel="Style Inspiration Video"
        accessibilityRole="button"
      >
        {/* Animated Fashion Content */}
        <Animated.View 
          style={[
            styles.fashionFrame,
            { 
              backgroundColor: currentFashion.color + '20',
              opacity: fadeAnim,
            }
          ]}
        >
          <View style={styles.fashionContent}>
            <Text style={styles.fashionEmoji}>{currentFashion.emoji}</Text>
            <Text style={styles.fashionText}>{currentFashion.text}</Text>
            <Text style={styles.fashionSubtext}>Style Inspiration</Text>
          </View>
        </Animated.View>
        
        {/* Video Overlay Controls */}
        <View style={styles.videoOverlay}>
          <View style={styles.playButtonContainer}>
            <View style={styles.playButton}>
              <Ionicons 
                name={isPlaying ? "pause" : "play"} 
                size={32} 
                color={theme.colors.white} 
              />
            </View>
          </View>
        </View>

        {/* Video Info Overlay */}
        <View style={styles.videoInfo}>
          <Text style={styles.videoTitle}>Style Inspiration</Text>
          <Text style={styles.videoSubtitle}>
            {isPlaying ? 'Playing • Tap to pause' : 'Paused • Tap to play'}
          </Text>
        </View>

        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          {fashionFrames.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                {
                  backgroundColor: index === currentFrame 
                    ? theme.colors.white 
                    : 'rgba(255, 255, 255, 0.3)',
                },
              ]}
            />
          ))}
        </View>
      </Pressable>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    width: '100%',
    height: 300,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  videoWrapper: {
    flex: 1,
    position: 'relative',
  },
  fashionFrame: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  fashionContent: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  fashionEmoji: {
    fontSize: 64,
    marginBottom: theme.spacing.lg,
  },
  fashionText: {
    fontSize: theme.typography['2xl'],
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  fashionSubtext: {
    fontSize: theme.typography.base,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  playButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  videoInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: theme.spacing.lg,
  },
  videoTitle: {
    fontSize: theme.typography.lg,
    fontWeight: theme.typography.bold,
    color: theme.colors.white,
    marginBottom: theme.spacing.xs,
  },
  videoSubtitle: {
    fontSize: theme.typography.sm,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  progressContainer: {
    position: 'absolute',
    top: theme.spacing.lg,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
