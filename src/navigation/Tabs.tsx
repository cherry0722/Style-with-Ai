import React, { useState } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import ComingSoonScreen from "../screens/ComingSoonScreen";
import HomeScreen from "../screens/HomeScreen";
import ClosetScreen from "../screens/ClosetScreen";
import OutfitScreen from "../screens/OutfitScreen";
import SettingsScreen from "../screens/SettingsScreen";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, Pressable, Modal } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "./RootNavigator";
import { useTheme } from "../context/ThemeContext";

export type TabParamList = {
  Home: undefined;
  Closet: undefined;
  Outfits: undefined;
  Settings: undefined;
  Avatar: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

export default function Tabs() {
  const { user, logout } = useAuth();
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    setMenuOpen(false);
    logout().then(() => {
      navigation.reset({ index: 0, routes: [{ name: 'AuthGate' }] });
    });
  }

  function iconFor(route: keyof TabParamList): keyof typeof Ionicons.glyphMap {
    switch (route) {
      case "Home":
        return "home-outline";
      case "Closet":
        return "shirt-outline";
      case "Outfits":
        return "grid-outline";
      case "Avatar":
        return "person-outline";
      case "Settings":
        return "settings-outline";
      default:
        return "grid-outline";
    }
  }

  return (
    <>
        <Tab.Navigator
          initialRouteName="Closet"
          screenOptions={({ route }) => ({
            // No auto-navigation to Outfits; user must tap Outfits tab
            headerTitle: () => (
              <Text style={{ fontWeight: "800", fontSize: 16 }}>
                {route.name}
              </Text>
            ),
            headerRight: () => (
              route.name === 'Settings' ? (
                <Pressable onPress={() => setMenuOpen(true)} style={{ paddingRight: 12 }}>
                  <Ionicons name="person-circle-outline" size={26} />
                </Pressable>
              ) : null
            ),
            headerTitleAlign: "center",
          tabBarIcon: ({ size, focused }) => (
            <Ionicons 
              name={iconFor(route.name) as any} 
              size={24} 
              color={focused ? theme.colors.accent : theme.colors.textTertiary}
            />
          ),
          tabBarActiveTintColor: theme.colors.accent,
          tabBarInactiveTintColor: theme.colors.textTertiary,
            tabBarStyle: {
              backgroundColor: theme.colors.background,
              borderTopColor: theme.colors.border,
              paddingBottom: 8,
              paddingTop: 8,
              height: 70,
              shadowColor: theme.colors.black,
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 8,
            },
          // 3D transition animations
          animation: 'shift',
          animationEnabled: true,
          swipeEnabled: true,
          tabBarHideOnKeyboard: true,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 3,
          },
          tabBarIconStyle: {
            marginTop: 3,
          },
        })}
      >
        <Tab.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ title: "Home", headerShown: false }} 
        />
        <Tab.Screen 
          name="Closet" 
          component={ClosetScreen} 
          options={{ title: "Closet", headerRight: () => null }} 
        />
        <Tab.Screen 
          name="Outfits" 
          component={OutfitScreen} 
          options={{ title: "Outfits" }} 
        />
        <Tab.Screen 
          name="Settings" 
          component={SettingsScreen} 
          options={{ title: "Settings" }} 
        />
        <Tab.Screen
          name="Avatar"
          component={ComingSoonScreen}
          options={{ title: "Avatar" }}
        />
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
