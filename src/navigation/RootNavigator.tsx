import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AuthGate from "../screens/AuthGate";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import SplashScreen from "../screens/SplashScreen";
import Tabs from "./Tabs";
import CalendarScreen from "../screens/CalendarScreen";

export type RootStackParamList = {
  Splash: undefined;
  AuthGate: undefined;
  Login: undefined;
  Signup: undefined;
  Main: undefined;
  Calendar: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="AuthGate" component={AuthGate} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="Main" component={Tabs} />
      <Stack.Screen name="Calendar" component={CalendarScreen} />
    </Stack.Navigator>
  );
}
