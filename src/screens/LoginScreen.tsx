import React from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import PremiumSignInScreen from "./PremiumSignInScreen";

export default function LoginScreen({ navigation }: NativeStackScreenProps<RootStackParamList, "Login">) {
  return <PremiumSignInScreen navigation={navigation} />;
}