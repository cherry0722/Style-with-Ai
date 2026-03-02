import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";

import SplashScreen from "../screens/SplashScreen";
import AuthScreen from "../screens/AuthScreen";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import GuestHomeScreen from "../screens/GuestHomeScreen";

import Tabs from "./Tabs";
import CalendarScreen from "../screens/CalendarScreen";
import HistoryScreen from "../screens/HistoryScreen";
import PlanOutfitSuggestionsScreen from "../screens/PlanOutfitSuggestionsScreen";
import OnboardingProfileScreen from "../screens/OnboardingProfileScreen";
import OutfitScreen from "../screens/OutfitScreen";
import LaundryScreen from "../screens/LaundryScreen";

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Login: undefined;
  Signup: undefined;
  GuestHome: undefined;
  Main: undefined;
  Calendar: undefined;
  History: undefined;
  Outfits: undefined;
  PlanOutfitSuggestions: { date: string; slotLabel: string; occasion: string };
  OnboardingProfile: undefined;
  Laundry: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Auth-gated navigator.
 * While hydrating (reading token from AsyncStorage): MYRA loading screen.
 * If token exists: authenticated stack (Tabs + all app screens).
 * If token missing: auth stack (Splash → Auth → Login → Signup).
 * React Navigation handles transitions automatically when token changes.
 */
export default function RootNavigator() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={hydrationStyles.container}>
        <ActivityIndicator size="large" color="#C4A882" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {token ? (
        <>
          <Stack.Screen name="Main" component={Tabs} />
          <Stack.Screen name="Calendar" component={CalendarScreen} />
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="Outfits" component={OutfitScreen} />
          <Stack.Screen name="PlanOutfitSuggestions" component={PlanOutfitSuggestionsScreen} />
          <Stack.Screen name="OnboardingProfile" component={OnboardingProfileScreen} />
          <Stack.Screen name="Laundry" component={LaundryScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Auth" component={AuthScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="GuestHome" component={GuestHomeScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

const hydrationStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F0E8",
  },
});
