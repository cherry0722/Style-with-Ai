import React, { useState } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import SignInForm from '../components/auth/SignInForm';
import SocialButtons from '../components/auth/SocialButtons';

const { width, height } = Dimensions.get('window');

interface SimpleSignInScreenProps {
  navigation?: any;
}

export default function SimpleSignInScreen({ navigation }: SimpleSignInScreenProps = {}) {
  const theme = useTheme();
  const [isLoading, setIsLoading] = useState(false);

  const styles = createStyles(theme);

  const handleSignInSuccess = () => {
    // Navigation will be handled by the auth context
  };

  const handleCreateAccount = () => {
    if (navigation) {
      navigation.navigate('Signup');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Background Gradient */}
      <LinearGradient
        colors={['#000000', '#1a1a1a', '#000000']}
        style={styles.backgroundGradient}
      />
      
      {/* Fashion Background Elements */}
      <View style={styles.fashionElements}>
        <View style={[styles.fashionElement, { top: height * 0.1, left: width * 0.1 }]}>
          <Text style={styles.fashionEmoji}>👗</Text>
        </View>
        <View style={[styles.fashionElement, { top: height * 0.2, right: width * 0.1 }]}>
          <Text style={styles.fashionEmoji}>👠</Text>
        </View>
        <View style={[styles.fashionElement, { top: height * 0.3, left: width * 0.2 }]}>
          <Text style={styles.fashionEmoji}>👜</Text>
        </View>
        <View style={[styles.fashionElement, { top: height * 0.4, right: width * 0.2 }]}>
          <Text style={styles.fashionEmoji}>💄</Text>
        </View>
        <View style={[styles.fashionElement, { top: height * 0.5, left: width * 0.15 }]}>
          <Text style={styles.fashionEmoji}>👑</Text>
        </View>
        <View style={[styles.fashionElement, { top: height * 0.6, right: width * 0.15 }]}>
          <Text style={styles.fashionEmoji}>🕶️</Text>
        </View>
      </View>

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
          <View style={styles.glassCard}>
            <LinearGradient
              colors={[
                'rgba(255, 255, 255, 0.1)',
                'rgba(255, 255, 255, 0.05)',
                'rgba(255, 255, 255, 0.1)',
              ]}
              style={styles.glassGradient}
            >
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
                  onLoadingChange={setIsLoading}
                />

                {/* Social Buttons */}
                <SocialButtons
                  onSignInSuccess={handleSignInSuccess}
                  isLoading={isLoading}
                />

                {/* Create Account Link */}
                <View style={styles.createAccountContainer}>
                  <Text style={styles.createAccountText}>Don't have an account? </Text>
                  <Pressable onPress={handleCreateAccount}>
                    <Text style={styles.createAccountLink}>Create account</Text>
                  </Pressable>
                </View>
              </View>
            </LinearGradient>
          </View>
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
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fashionElements: {
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
    opacity: 0.1,
  },
  fashionEmoji: {
    fontSize: 24,
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
