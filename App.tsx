import React from "react";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import RootNavigator from "./src/navigation/RootNavigator";
import type { RootStackParamList } from "./src/navigation/RootNavigator";
import { AuthProvider } from "./src/context/AuthContext";
import { ThemeProvider } from "./src/context/ThemeContext";

const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function App() {
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

