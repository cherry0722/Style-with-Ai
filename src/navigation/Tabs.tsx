import React, { useMemo, useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import ClosetScreen from "../screens/ClosetScreen";
import ScanScreen from "../screens/ScanScreen";
import OutfitIdeasScreen from "../screens/OutfitIdeasScreen";
import FavoritesScreen from "../screens/FavoritesScreen";
import SettingsScreen from "../screens/SettingsScreen";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, Pressable, Modal } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "./RootNavigator";

export type TabParamList = {
  Closet: undefined;
  Scan: undefined;
  Ideas: undefined;
  Favs: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

export default function Tabs() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [menuOpen, setMenuOpen] = useState(false);

  const firstName = useMemo(() => {
    if (user?.profile?.preferredName) return user.profile.preferredName;
    if (user?.displayName) return user.displayName;
    if (user?.email) return (user.email.split("@")[0] || "there");
    if (user?.phone) return user.phone;
    return "there";
  }, [user]);

  function handleLogout() {
    setMenuOpen(false);
    logout();
    navigation.replace("Login");
  }

  function iconFor(route: keyof TabParamList): keyof typeof Ionicons.glyphMap {
    switch (route) {
      case "Closet":
        return "shirt-outline";
      case "Scan":
        return "camera-outline";
      case "Ideas":
        return "color-wand-outline";
      case "Favs":
        return "heart-outline";
      case "Settings":
        return "settings-outline";
      default:
        return "grid-outline";
    }
  }

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerTitle: () => (
            <Text style={{ fontWeight: "800", fontSize: 16 }}>Hi, {firstName} 👋</Text>
          ),
          headerRight: () => (
            <Pressable onPress={() => setMenuOpen(true)} style={{ paddingRight: 12 }}>
              <Ionicons name="person-circle-outline" size={26} />
            </Pressable>
          ),
          headerTitleAlign: "center",
          tabBarIcon: ({ size }) => <Ionicons name={iconFor(route.name) as any} size={size} />,
        })}
      >
        <Tab.Screen name="Closet" component={ClosetScreen} />
        <Tab.Screen name="Scan" component={ScanScreen} />
        <Tab.Screen name="Ideas" component={OutfitIdeasScreen} options={{ title: "Outfit Ideas" }} />
        <Tab.Screen name="Favs" component={FavoritesScreen} options={{ title: "Favorites" }} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>

      {/* Simple logout menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.2)" }} onPress={() => setMenuOpen(false)}>
          <View
            style={{
              position: "absolute",
              right: 12,
              top: 60,
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: 12,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 8,
              minWidth: 180,
              gap: 8,
            }}
          >
            <Text style={{ fontWeight: "700" }}>{user?.email || user?.phone || "Account"}</Text>
            <Pressable onPress={handleLogout} style={{ paddingVertical: 8 }}>
              <Text style={{ color: "#e11", fontWeight: "700" }}>Log out</Text>
            </Pressable>
            <Pressable onPress={() => setMenuOpen(false)} style={{ paddingVertical: 6 }}>
              <Text>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
