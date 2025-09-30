import React, { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "../context/AuthContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";

export default function AuthGate({ navigation }: NativeStackScreenProps<RootStackParamList, "AuthGate">) {
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigation.replace("Main");
    else navigation.replace("Splash");
  }, [user]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
    </View>
  );
}
