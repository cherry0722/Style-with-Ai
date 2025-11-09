import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface StyleInspirationVideoProps {
  videoSource?: any; // Will be set when user provides video
}

export default function StyleInspirationVideo({ 
  videoSource
}: StyleInspirationVideoProps) {
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [_hasError, _setHasError] = useState(false);
  const videoRef = useRef<Video>(null);

  const styles = createStyles(theme);

  const handleVideoLoad = async (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsLoading(false);
      _setHasError(false);
      // Auto-play the video when it loads
      try {
        await videoRef.current?.playAsync();
      } catch (error) {
        console.error('Error auto-playing video:', error);
        _setHasError(true);
      }
    }
  };

  const handleVideoError = (error: any) => {
    console.error('Video error:', error);
    _setHasError(true);
    setIsLoading(false);
  };

  if (!videoSource) {
    return (
      <View style={styles.container}>
        <View style={styles.placeholder}>
          <View style={styles.placeholderContent}>
            <Ionicons 
              name="videocam-outline" 
              size={48} 
              color={theme.colors.textTertiary} 
            />
            <Text style={styles.placeholderTitle}>Style Inspiration Video</Text>
            <Text style={styles.placeholderSubtext}>
              Ready to display your fashion video
            </Text>
            <Text style={styles.placeholderInstruction}>
              Add your video file to src/assets/video/ and update HomeScreen.tsx
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.videoWrapper}>
        <Video
          ref={videoRef}
          source={videoSource}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          shouldPlay={true}
          isLooping={true}
          isMuted={false}
          onLoad={handleVideoLoad}
          onError={handleVideoError}
        />
        
        {/* Loading Overlay */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <Ionicons 
                name="refresh" 
                size={24} 
                color={theme.colors.white} 
              />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          </View>
        )}

        {/* Video Info Overlay */}
        <View style={styles.videoInfo}>
          <Text style={styles.videoSubtitle}>Your daily fashion inspiration</Text>
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    width: '100%',
    height: 1200, // Maximum vertical to show full person
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    ...theme.shadows.md,
  },
  placeholder: {
    flex: 1,
    backgroundColor: theme.colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderContent: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  placeholderTitle: {
    fontSize: theme.typography.lg,
    fontWeight: theme.typography.medium,
    color: theme.colors.textPrimary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  placeholderSubtext: {
    fontSize: theme.typography.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  placeholderInstruction: {
    fontSize: theme.typography.sm,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  videoWrapper: {
    flex: 1,
    position: 'relative',
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  loadingText: {
    color: theme.colors.white,
    marginLeft: theme.spacing.sm,
    fontSize: theme.typography.base,
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
});
