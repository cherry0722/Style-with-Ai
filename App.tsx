import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import RootNavigator from "./src/navigation/RootNavigator";
import { AuthProvider } from "./src/context/AuthContext";
import { ThemeProvider } from "./src/context/ThemeContext";

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <NavigationContainer>
          <StatusBar style="auto" />
          <RootNavigator />
        </NavigationContainer>
      </ThemeProvider>
    </AuthProvider>
  );
}

