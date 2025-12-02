import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";

/**
 * AuthGate: Decides initial routing after app launch
 * 
 * Flow:
 * 1. Show loading spinner while AuthContext is loading user/token from AsyncStorage
 * 2. Once loading completes:
 *    - If user exists (restored from storage or already logged in) → navigate to Main (Tabs)
 *    - If no user (no token/user data) → navigate to Login
 * 
 * This screen should only be accessible during startup/logout flows, not from within the tabs.
 */
export default function AuthGate({ navigation }: NativeStackScreenProps<RootStackParamList, "AuthGate">) {
  const { user, loading } = useAuth();
  const theme = useTheme();
  const styles = createStyles(theme);

  useEffect(() => {
    // Wait for auth initialization to complete
    if (loading) {
      return;
    }

    // Once loading finishes, route based on auth state
    if (user) {
      // User is authenticated (restored from storage or logged in)
      // Use reset to prevent going back to Splash/AuthGate
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    } else {
      // No user found, redirect to login
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  }, [user, loading, navigation]);

  // Show loading spinner while checking auth state
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.accent} />
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.background,
    },
  });
