import React, { useState, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import RootNavigator from "./src/navigation/RootNavigator";
import type { RootStackParamList } from "./src/navigation/RootNavigator";
import { AuthProvider } from "./src/context/AuthContext";
import { ThemeProvider } from "./src/context/ThemeContext";
import { runStorageMigration } from "./src/store/storageMigration";

const navigationRef = createNavigationContainerRef<RootStackParamList>();

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
    <AuthProvider navRef={navigationRef}>
      <ThemeProvider>
        <NavigationContainer ref={navigationRef}>
          <StatusBar style="auto" />
          <RootNavigator />
        </NavigationContainer>
      </ThemeProvider>
    </AuthProvider>
  );
}
