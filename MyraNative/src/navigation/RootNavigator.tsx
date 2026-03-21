/**
 * MyraNative — RootNavigator
 * Real auth-gated stack, ported from the Expo app.
 *
 * TEMPORARY PLACEHOLDERS (marked TODO — remove when milestone resolves):
 *   "Login"    → ComingSoonScreen — replace when expo-haptics is replaced (PremiumSignInScreen)
 *   "Calendar" → ComingSoonScreen — replace when expo-haptics is replaced (CalendarScreen)
 *   Tabs/Home  → ComingSoonScreen — replace when expo-location is replaced (HomeScreen)
 *   Tabs/Settings → ComingSoonScreen — replace when expo-haptics is replaced (SettingsScreen)
 */
import React from 'react';
import {View, ActivityIndicator, StyleSheet} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {useAuth} from '../context/AuthContext';

import SplashScreen from '../screens/SplashScreen';
import AuthScreen from '../screens/AuthScreen';
import SignupScreen from '../screens/SignupScreen';
import GuestHomeScreen from '../screens/GuestHomeScreen';
import ComingSoonScreen from '../screens/ComingSoonScreen';

import Tabs from './Tabs';
import HistoryScreen from '../screens/HistoryScreen';
import OutfitScreen from '../screens/OutfitScreen';
import PlanOutfitSuggestionsScreen from '../screens/PlanOutfitSuggestionsScreen';
import OnboardingProfileScreen from '../screens/OnboardingProfileScreen';
import LaundryScreen from '../screens/LaundryScreen';
import PasswordAndSecurityScreen from '../screens/PasswordAndSecurityScreen';
import AccountPrivacyScreen from '../screens/AccountPrivacyScreen';

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
  PlanOutfitSuggestions: {date: string; slotLabel: string; occasion: string};
  OnboardingProfile: undefined;
  Laundry: undefined;
  PasswordAndSecurity: undefined;
  AccountPrivacy: undefined;
  InformationPermissions: undefined;
  Saved: undefined;
  Favorites: undefined;
  Activity: undefined;
  Help: undefined;
  About: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const {token, loading} = useAuth();

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#C4A882" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      {token ? (
        <>
          <Stack.Screen name="Main" component={Tabs} />
          {/* TODO: replace with CalendarScreen when expo-haptics is replaced */}
          <Stack.Screen name="Calendar" component={ComingSoonScreen} />
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="Outfits" component={OutfitScreen} />
          <Stack.Screen
            name="PlanOutfitSuggestions"
            component={PlanOutfitSuggestionsScreen}
          />
          <Stack.Screen
            name="OnboardingProfile"
            component={OnboardingProfileScreen}
          />
          <Stack.Screen name="Laundry" component={LaundryScreen} />
          <Stack.Screen
            name="PasswordAndSecurity"
            component={PasswordAndSecurityScreen}
          />
          <Stack.Screen name="AccountPrivacy" component={AccountPrivacyScreen} />
          <Stack.Screen
            name="InformationPermissions"
            component={ComingSoonScreen}
          />
          <Stack.Screen name="Saved" component={ComingSoonScreen} />
          <Stack.Screen name="Favorites" component={ComingSoonScreen} />
          <Stack.Screen name="Activity" component={ComingSoonScreen} />
          <Stack.Screen name="Help" component={ComingSoonScreen} />
          <Stack.Screen name="About" component={ComingSoonScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Auth" component={AuthScreen} />
          {/* TODO: replace with real LoginScreen when expo-haptics is replaced (PremiumSignInScreen) */}
          <Stack.Screen name="Login" component={ComingSoonScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="GuestHome" component={GuestHomeScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F0E8',
  },
});
