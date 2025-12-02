import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Ionicons } from "@expo/vector-icons";

// Password input component with visibility toggle
function PasswordInput({
  value,
  onChangeText,
  placeholder,
  style,
  onClearError,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  style?: any;
  onClearError?: () => void;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const theme = useTheme();

  return (
    <View style={[styles(theme).inputContainer, style]}>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textTertiary}
        value={value}
        onChangeText={(text) => {
          onChangeText(text);
          onClearError?.();
        }}
        secureTextEntry={!isVisible}
        style={styles(theme).input}
        autoCapitalize="none"
      />
      <Pressable
        onPress={() => setIsVisible(!isVisible)}
        style={styles(theme).passwordToggle}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name={isVisible ? "eye-off-outline" : "eye-outline"}
          size={20}
          color={theme.colors.textTertiary}
        />
      </Pressable>
    </View>
  );
}

export default function SignupScreen({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "Signup">) {
  const { signup } = useAuth();
  const theme = useTheme();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSignup() {
    // Validation
    if (!username.trim()) {
      setError("Username is required");
      return;
    }
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!password.trim()) {
      setError("Password is required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await signup(email, password, username, phone);
      setLoading(false);
      navigation.replace("Main");
    } catch (err: any) {
      setLoading(false);
      setError(err.message || "Signup failed. Please try again.");
      console.error("Signup error:", err);
    }
  }

  const themeStyles = styles(theme);

  return (
    <KeyboardAvoidingView
      style={themeStyles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      
      <ScrollView
        contentContainerStyle={themeStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Form Card - Centered */}
        <View style={themeStyles.card}>
          {/* Header - Inside Card */}
          <View style={themeStyles.header}>
            <Text style={themeStyles.title}>Create your MYRA account</Text>
            <Text style={themeStyles.subtitle}>
              We'll tailor outfits to your style & body profile.
            </Text>
          </View>
          {/* Username Input */}
          <View style={themeStyles.inputGroup}>
            <Text style={themeStyles.label}>Preferred name / Username</Text>
            <TextInput
              placeholder="Enter your username"
              placeholderTextColor={theme.colors.textTertiary}
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                if (error) setError("");
              }}
              style={themeStyles.input}
              autoCapitalize="words"
            />
          </View>

          {/* Email Input */}
          <View style={themeStyles.inputGroup}>
            <Text style={themeStyles.label}>Email</Text>
            <TextInput
              placeholder="your@email.com"
              placeholderTextColor={theme.colors.textTertiary}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) setError("");
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={themeStyles.input}
            />
          </View>

          {/* Password Input */}
          <View style={themeStyles.inputGroup}>
            <Text style={themeStyles.label}>Password</Text>
            <PasswordInput
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (error) setError("");
              }}
              placeholder="Enter your password"
              onClearError={() => setError("")}
            />
          </View>

          {/* Phone Input */}
          <View style={themeStyles.inputGroup}>
            <Text style={themeStyles.label}>Phone (optional)</Text>
            <TextInput
              placeholder="Enter your phone number"
              placeholderTextColor={theme.colors.textTertiary}
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                if (error) setError("");
              }}
              keyboardType="phone-pad"
              style={themeStyles.input}
            />
          </View>

          {/* Error Message - Below fields, above button */}
          {error ? (
            <View style={themeStyles.errorContainerBottom}>
              <Ionicons name="alert-circle-outline" size={16} color={theme.colors.error} />
              <Text style={themeStyles.errorTextBottom}>{error}</Text>
            </View>
          ) : null}

          {/* Sign Up Button */}
          <Pressable
            onPress={onSignup}
            disabled={loading}
            style={({ pressed }) => [
              themeStyles.signupButton,
              (pressed || loading) && themeStyles.signupButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Sign up"
            accessibilityState={{ disabled: loading }}
          >
            {loading ? (
              <View style={themeStyles.buttonContent}>
                <ActivityIndicator size="small" color={theme.colors.white} />
                <Text style={themeStyles.signupButtonText}>Creating account...</Text>
              </View>
            ) : (
              <Text style={themeStyles.signupButtonText}>Sign up</Text>
            )}
          </Pressable>

          {/* Login Link - Inside Card */}
          <View style={themeStyles.loginContainer}>
            <Text style={themeStyles.loginText}>Already have an account? </Text>
            <Pressable
              onPress={() => navigation.navigate("Login")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {({ pressed }) => (
                <Text style={[
                  themeStyles.loginLink,
                  pressed && themeStyles.loginLinkPressed
                ]}>
                  Log in
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: Platform.OS === "ios" ? 60 : 40,
      paddingBottom: theme.spacing.xl,
      justifyContent: "center",
    },
    card: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius["2xl"],
      padding: theme.spacing["2xl"],
      marginVertical: theme.spacing.xl,
      ...theme.shadows.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      maxWidth: 480,
      alignSelf: "center",
      width: "100%",
    },
    header: {
      marginBottom: theme.spacing["2xl"],
      alignItems: "center",
    },
    title: {
      fontSize: theme.typography["2xl"],
      fontWeight: theme.typography.bold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
      textAlign: "center",
      letterSpacing: 0.5,
    },
    subtitle: {
      fontSize: theme.typography.sm,
      color: theme.colors.textSecondary,
      lineHeight: theme.typography.sm * theme.typography.lineHeight,
      textAlign: "center",
    },
    errorContainerBottom: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.error + "15",
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    errorTextBottom: {
      flex: 1,
      fontSize: theme.typography.sm,
      color: theme.colors.error,
      lineHeight: theme.typography.sm * theme.typography.lineHeight,
    },
    inputGroup: {
      marginBottom: theme.spacing.lg,
    },
    label: {
      fontSize: theme.typography.sm,
      fontWeight: theme.typography.medium,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.background,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.lg,
    },
    input: {
      flex: 1,
      fontSize: theme.typography.base,
      color: theme.colors.textPrimary,
      paddingVertical: theme.spacing.md,
      minHeight: 52,
    },
    passwordToggle: {
      padding: theme.spacing.xs,
      marginLeft: theme.spacing.xs,
    },
    signupButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: 999,
      paddingVertical: theme.spacing.lg,
      paddingHorizontal: theme.spacing.xl,
      marginTop: theme.spacing.lg,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 56,
      ...theme.shadows.md,
    },
    signupButtonDisabled: {
      opacity: 0.6,
    },
    buttonContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    signupButtonText: {
      fontSize: theme.typography.lg,
      fontWeight: theme.typography.bold,
      color: theme.colors.white,
    },
    loginContainer: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginTop: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    loginText: {
      fontSize: theme.typography.sm,
      color: theme.colors.textSecondary,
    },
    loginLink: {
      fontSize: theme.typography.sm,
      color: theme.colors.accent,
      fontWeight: theme.typography.bold,
      marginLeft: theme.spacing.xs,
    },
    loginLinkPressed: {
      textDecorationLine: "underline",
    },
  });
