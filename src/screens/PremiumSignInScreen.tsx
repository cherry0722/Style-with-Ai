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
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import SignInForm from '../components/auth/SignInForm';
import SocialButtons from '../components/auth/SocialButtons';
import { hapticFeedback } from '../utils/haptics';

const { width, height } = Dimensions.get('window');

interface PremiumSignInScreenProps {
  navigation?: any;
}

export default function PremiumSignInScreen({ navigation }: PremiumSignInScreenProps = {}) {
  const theme = useTheme();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const styles = createStyles(theme);

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

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle={theme.isDark ? "light-content" : "dark-content"} 
        backgroundColor="transparent" 
        translucent 
      />
      
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
          {/* Simple Clean Card */}
          <View style={styles.card}>
            {/* MYRA Logo and Brand */}
            <View style={styles.brandContainer}>
              <Text style={styles.brandName}>MYRA</Text>
              <Text style={styles.brandTagline}>Your Personal Style Assistant</Text>
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
              <Pressable onPress={handleCreateAccount} disabled={isLoading}>
                <Text style={styles.createAccountLink}>Create account</Text>
              </Pressable>
            </View>
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
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['2xl'],
    ...theme.shadows.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing['2xl'],
  },
  brandName: {
    fontSize: theme.typography['5xl'],
    fontWeight: theme.typography.bold,
    color: theme.colors.textPrimary,
    letterSpacing: 3,
    marginBottom: theme.spacing.sm,
    fontFamily: 'Didot',
    textAlign: 'center',
  },
  brandTagline: {
    fontSize: theme.typography.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontWeight: theme.typography.medium,
    letterSpacing: 0.5,
  },
  createAccountContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  createAccountText: {
    fontSize: theme.typography.base,
    color: theme.colors.textSecondary,
  },
  createAccountLink: {
    fontSize: theme.typography.base,
    color: theme.colors.accent,
    fontWeight: theme.typography.semibold,
  },
});
