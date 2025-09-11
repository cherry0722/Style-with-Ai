import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AuthGate from "../screens/AuthGate";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import Tabs from "./Tabs";

export type RootStackParamList = {
  AuthGate: undefined;
  Login: undefined;
  Signup: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AuthGate" component={AuthGate} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="Main" component={Tabs} />
    </Stack.Navigator>
  );
}
