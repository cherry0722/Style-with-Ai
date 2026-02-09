import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AuthGate from "../screens/AuthGate";
import AuthScreen from "../screens/AuthScreen";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import SplashScreen from "../screens/SplashScreen";
import Tabs from "./Tabs";
import CalendarScreen from "../screens/CalendarScreen";
import HistoryScreen from "../screens/HistoryScreen";
import PlanOutfitSuggestionsScreen from "../screens/PlanOutfitSuggestionsScreen";
import OnboardingProfileScreen from "../screens/OnboardingProfileScreen";

export type RootStackParamList = {
  Splash: undefined;
  AuthGate: undefined;
  Auth: undefined;
  Login: undefined;
  Signup: undefined;
  Main: undefined;
  Calendar: undefined;
  History: undefined;
  PlanOutfitSuggestions: { date: string; slotLabel: string; occasion: string };
  OnboardingProfile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="AuthGate" component={AuthGate} />
      <Stack.Screen name="Auth" component={AuthScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="Main" component={Tabs} />
      <Stack.Screen name="Calendar" component={CalendarScreen} />
      <Stack.Screen name="History" component={HistoryScreen} />
      <Stack.Screen name="PlanOutfitSuggestions" component={PlanOutfitSuggestionsScreen} />
      <Stack.Screen
        name="OnboardingProfile"
        component={OnboardingProfileScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
