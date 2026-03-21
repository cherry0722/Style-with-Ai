import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { hapticFeedback } from '../../utils/haptics';

interface SocialButtonsProps {
  onSignInSuccess: () => void;
  isLoading: boolean;
}

export default function SocialButtons({ onSignInSuccess, isLoading }: SocialButtonsProps) {
  const theme = useTheme();
  const { loginWithGoogle, loginWithApple, loginWithPhone } = useAuth();

  const styles = createStyles(theme);

  const handleGoogleSignIn = async () => {
    try {
      hapticFeedback.light();
      await loginWithGoogle();
      onSignInSuccess();
    } catch (error) {
      hapticFeedback.error();
    }
  };

  const handleAppleSignIn = async () => {
    try {
      hapticFeedback.light();
      await loginWithApple();
      onSignInSuccess();
    } catch (error) {
      hapticFeedback.error();
    }
  };

  const handlePhoneSignIn = async () => {
    try {
      hapticFeedback.light();
      await loginWithPhone("555-0100");
      onSignInSuccess();
    } catch (error) {
      hapticFeedback.error();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.buttonsContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.socialButton,
            { opacity: pressed || isLoading ? 0.7 : 1 }
          ]}
          onPress={handleGoogleSignIn}
          disabled={isLoading}
        >
          <Ionicons name="logo-google" size={24} color={theme.colors.textPrimary} />
          <Text style={styles.socialButtonText}>Google</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.socialButton,
            { opacity: pressed || isLoading ? 0.7 : 1 }
          ]}
          onPress={handleAppleSignIn}
          disabled={isLoading}
        >
          <Ionicons name="logo-apple" size={24} color={theme.colors.textPrimary} />
          <Text style={styles.socialButtonText}>Apple</Text>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.phoneButton,
          { opacity: pressed || isLoading ? 0.7 : 1 }
        ]}
        onPress={handlePhoneSignIn}
        disabled={isLoading}
      >
        <Ionicons name="call-outline" size={20} color={theme.colors.textPrimary} />
        <Text style={styles.phoneButtonText}>Continue with Phone</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    width: '100%',
    gap: theme.spacing.lg,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.borderLight,
    opacity: 0.6,
  },
  dividerText: {
    fontSize: theme.typography.sm,
    color: theme.colors.textTertiary,
    marginHorizontal: theme.spacing.md,
    fontWeight: '300',
    fontStyle: 'italic',
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.white,
    gap: theme.spacing.sm,
    ...theme.shadows.sm,
    shadowColor: theme.colors.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  socialButtonText: {
    fontSize: theme.typography.base,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    backgroundColor: theme.colors.white,
    gap: theme.spacing.sm,
    ...theme.shadows.sm,
    shadowColor: theme.colors.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  phoneButtonText: {
    fontSize: theme.typography.base,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
});
