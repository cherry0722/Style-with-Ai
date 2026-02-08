import React, { useEffect, useRef } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";

/**
 * AuthGate: Decides initial routing after app launch.
 * Does not redirect until isRestoring === false. Navigates exactly once (ref guard).
 * Token exists -> Main; else Auth. No flicker, no double navigation, no loop.
 */
export default function AuthGate({ navigation }: NativeStackScreenProps<RootStackParamList, "AuthGate">) {
  const { user, loading, isRestoring } = useAuth();
  const theme = useTheme();
  const styles = createStyles(theme);
  const ready = !loading && !isRestoring;
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    if (!ready) return;
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    if (user) {
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
    }
  }, [user, ready, navigation]);

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
