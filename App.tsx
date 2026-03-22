import React, { useState, useEffect, useRef } from "react";
import { View, ActivityIndicator, AppState, AppStateStatus } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import RootNavigator from "./src/navigation/RootNavigator";
import type { RootStackParamList } from "./src/navigation/RootNavigator";
import { AuthProvider } from "./src/context/AuthContext";
import { ThemeProvider } from "./src/context/ThemeContext";
import { runStorageMigration } from "./src/store/storageMigration";
import { useSettings } from "./src/store/settings";

const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Tracks foreground time at the root level so every second in the app is counted. */
function AppTimeTracker() {
  const addTimeSpent  = useSettings((s) => s.addTimeSpent);
  const appState      = useRef<AppStateStatus>(AppState.currentState);
  const sessionStart  = useRef<number>(Date.now());

  useEffect(() => {
    sessionStart.current = Date.now();

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current === 'active' && next !== 'active') {
        addTimeSpent(Date.now() - sessionStart.current);
      }
      if (next === 'active') {
        sessionStart.current = Date.now();
      }
      appState.current = next;
    });

    return () => {
      addTimeSpent(Date.now() - sessionStart.current);
      sub.remove();
    };
  }, []);

  return null;
}

export default function App() {
  const [migrationDone, setMigrationDone] = useState(false);

  useEffect(() => {
    runStorageMigration().then(() => setMigrationDone(true));
  }, []);

  if (!migrationDone) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FEFCFB" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider navRef={navigationRef}>
        <ThemeProvider>
          <NavigationContainer ref={navigationRef}>
            <StatusBar style="auto" />
            <AppTimeTracker />
            <RootNavigator />
          </NavigationContainer>
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
