import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { hapticFeedback } from '../../utils/haptics';

interface SignInFormProps {
  onSignInSuccess: () => void;
  isLoading: boolean;
  onLoadingChange: (loading: boolean) => void;
}

export default function SignInForm({ onSignInSuccess, isLoading, onLoadingChange }: SignInFormProps) {
  const theme = useTheme();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const styles = createStyles(theme);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password.trim()) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async () => {
    if (!validateForm()) {
      hapticFeedback.error();
      return;
    }

    try {
      onLoadingChange(true);
      hapticFeedback.light();
      
      await login(email.trim(), password);
      onSignInSuccess();
    } catch (error) {
      hapticFeedback.error();
      Alert.alert('Sign In Failed', 'Please check your credentials and try again.');
    } finally {
      onLoadingChange(false);
    }
  };

  const handleForgotPassword = () => {
    hapticFeedback.light();
    Alert.alert('Forgot Password', 'Password reset functionality will be implemented soon.');
  };

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        {/* Email Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputIcon}>
            <Ionicons name="mail-outline" size={20} color={theme.colors.textTertiary} />
          </View>
          <TextInput
            placeholder="Email address"
            placeholderTextColor={theme.colors.textTertiary}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) {
                setErrors({ ...errors, email: undefined });
              }
            }}
            style={[styles.input, errors.email && styles.inputError]}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!isLoading}
          />
        </View>
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

        {/* Password Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputIcon}>
            <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textTertiary} />
          </View>
          <TextInput
            placeholder="Password"
            placeholderTextColor={theme.colors.textTertiary}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) {
                setErrors({ ...errors, password: undefined });
              }
            }}
            style={[styles.input, errors.password && styles.inputError]}
            secureTextEntry={!showPassword}
            autoComplete="password"
            editable={!isLoading}
          />
          <Pressable
            style={styles.passwordToggle}
            onPress={() => setShowPassword(!showPassword)}
            disabled={isLoading}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={theme.colors.textTertiary}
            />
          </Pressable>
        </View>
        {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

        {/* Forgot Password */}
        <Pressable
          style={styles.forgotPassword}
          onPress={handleForgotPassword}
          disabled={isLoading}
        >
          <Text style={styles.forgotPasswordText}>Forgot password?</Text>
        </Pressable>

        {/* Sign In Button */}
        <Pressable
          style={({ pressed }) => [
            styles.signInButton,
            { opacity: pressed || isLoading ? 0.8 : 1 }
          ]}
          onPress={handleSignIn}
          disabled={isLoading}
        >
          <Text style={styles.signInButtonText}>
            {isLoading ? 'Signing in...' : 'Sign in'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    width: '100%',
  },
  form: {
    gap: theme.spacing.lg,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 56,
    ...theme.shadows.sm,
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputIcon: {
    padding: theme.spacing.md,
  },
  input: {
    flex: 1,
    fontSize: theme.typography.base,
    color: theme.colors.textPrimary,
    paddingVertical: theme.spacing.md,
    paddingRight: theme.spacing.md,
  },
  inputError: {
    borderColor: theme.colors.error,
  },
  passwordToggle: {
    padding: theme.spacing.md,
  },
  errorText: {
    fontSize: theme.typography.sm,
    color: theme.colors.error,
    marginTop: -theme.spacing.md,
    marginLeft: theme.spacing.sm,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  forgotPasswordText: {
    fontSize: theme.typography.sm,
    color: theme.colors.accent,
    fontWeight: '500',
  },
  signInButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    marginTop: theme.spacing.md,
    ...theme.shadows.lg,
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  signInButtonText: {
    fontSize: theme.typography.lg,
    fontWeight: 'bold',
    color: theme.colors.white,
  },
});
