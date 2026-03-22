import React, { useCallback } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import ComingSoonScreen from "../screens/ComingSoonScreen";
import HomeScreen from "../screens/HomeScreen";
import ClosetScreen from "../screens/ClosetScreen";
import SettingsScreen from "../screens/SettingsScreen";
import { Ionicons } from "@expo/vector-icons";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ActionSheetIOS,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { uploadWardrobeItem } from "../api/wardrobe";

export type TabParamList = {
  Home: undefined;
  Closet: undefined;
  AddItem: undefined;
  Avatar: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

function iconFor(route: keyof TabParamList): keyof typeof Ionicons.glyphMap {
  switch (route) {
    case "Home":     return "home-outline";
    case "Closet":   return "shirt-outline";
    case "Avatar":   return "person-outline";
    case "Settings": return "settings-outline";
    default:         return "grid-outline";
  }
}

function renderTabIcon(
  iconName: keyof typeof Ionicons.glyphMap,
  color: string,
  focused: boolean,
  accentColor: string,
) {
  return (
    <View style={tabStyles.iconWrap}>
      <Ionicons name={iconName} size={22} color={color} />
      {focused && <View style={[tabStyles.activeBar, { backgroundColor: accentColor }]} />}
    </View>
  );
}

function renderTabLabel(label: string, focused: boolean, color: string) {
  return (
    <Text
      style={[
        tabStyles.label,
        { color, fontWeight: focused ? "700" : "500", marginTop: focused ? 0 : 5 },
      ]}
    >
      {label}
    </Text>
  );
}

function DummyScreen() {
  return null;
}

function AddItemTabButton({ onPress }: Readonly<{ onPress: () => void }>) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Pressable
        style={({ pressed }) => [
          tabStyles.fabOuter,
          pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] },
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Add clothing item"
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconWrap: { alignItems: "center", justifyContent: "center" },
  activeBar: { height: 2, width: 20, borderRadius: 1, marginTop: 3 },
  label: { fontSize: 10, letterSpacing: 0.3 },
  fabOuter: {
    position: "absolute",
    top: -22,
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#3D3426",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "rgba(61, 52, 38, 0.30)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 8,
  },
});

export default function Tabs() {
  const theme = useTheme();
  const { user } = useAuth();

  const handleAddItem = useCallback(() => {
    if (!user) {
      Alert.alert("Sign in required", "Please sign in to add items.");
      return;
    }

    const pickFromCamera = async () => {
      try {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Camera Permission Required",
            "Please enable Camera access in Settings → Information & Permissions, then try again."
          );
          return;
        }
        const r = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
        if (!r.canceled && r.assets?.length) {
          try {
            await uploadWardrobeItem(r.assets[0].uri);
            Alert.alert("Success", "Item added to your closet!");
          } catch (err: any) {
            Alert.alert("Upload failed", err?.message || "Please try again.");
          }
        }
      } catch {
        Alert.alert("Error", "Failed to open camera.");
      }
    };

    const pickFromLibrary = async () => {
      try {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Photo Library Permission Required",
            "Please enable Photo Library access in Settings → Information & Permissions, then try again."
          );
          return;
        }
        const r = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
        if (!r.canceled && r.assets?.length) {
          try {
            await uploadWardrobeItem(r.assets[0].uri);
            Alert.alert("Success", "Item added to your closet!");
          } catch (err: any) {
            Alert.alert("Upload failed", err?.message || "Please try again.");
          }
        }
      } catch {
        Alert.alert("Error", "Failed to open library.");
      }
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Take photo", "Choose from library"],
          cancelButtonIndex: 0,
        },
        (i) => {
          if (i === 1) void pickFromCamera();
          else if (i === 2) void pickFromLibrary();
        },
      );
    } else {
      Alert.alert("Add Item", "Choose source", [
        { text: "Cancel", style: "cancel" },
        { text: "Take photo", onPress: () => void pickFromCamera() },
        { text: "Choose from library", onPress: () => void pickFromLibrary() },
      ]);
    }
  }, [user]);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => {
          if (route.name === "AddItem") {
            return null;
          }
          return renderTabIcon(iconFor(route.name), color, focused, theme.colors.accent);
        },
        tabBarLabel: ({ focused, color }) => {
          if (route.name === "AddItem") {
            return null;
          }
          return renderTabLabel(route.name, focused, color);
        },
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.backgroundSecondary,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 10,
          height: 72,
          shadowColor: "rgba(61, 52, 38, 0.10)",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 1,
          shadowRadius: 12,
          elevation: 8,
        },
        tabBarItemStyle: { paddingBottom: 0 },
        tabBarHideOnKeyboard: true,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Closet" component={ClosetScreen} />
      <Tab.Screen
        name="AddItem"
        component={DummyScreen}
        options={{
          // eslint-disable-next-line react/no-unstable-nested-components
          tabBarButton: () => <AddItemTabButton onPress={handleAddItem} />,
        }}
      />
      <Tab.Screen name="Avatar" component={ComingSoonScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
