/**
 * MyraNative — Tabs navigator
 * Ported from src/navigation/Tabs.tsx in the Expo app.
 *
 * Changes from Expo version:
 *   - expo-image-picker  → react-native-image-picker  (FAB upload)
 *   - HomeScreen: real screen (expo-location → react-native-geolocation-service ✓)
 *   - SettingsScreen: real screen (expo-haptics → react-native-haptic-feedback ✓)
 *
 * Icon names typed as string because @expo/vector-icons is Metro-aliased to a stub
 * during this migration phase (glyphMap property not available on stub).
 */
import React, { useCallback } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Avatar3DScreen from '../screens/Avatar3DScreen';
import HomeScreen from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ClosetScreen from '../screens/ClosetScreen';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from './RootNavigator';


export type TabParamList = {
  Home: undefined;
  Closet: undefined;
  AddItem: undefined;
  Avatar: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function iconFor(route: keyof TabParamList): any {
  switch (route) {
    case 'Home':     return 'home-outline';
    case 'Closet':   return 'shirt-outline';
    case 'Avatar':   return 'person-outline';
    case 'Settings': return 'settings-outline';
    default:         return 'grid-outline';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderTabIcon(iconName: any, color: string, focused: boolean, accentColor: string) {
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
        { color, fontWeight: focused ? '700' : '500', marginTop: focused ? 0 : 5 },
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
    <View style={{ flex: 1, alignItems: 'center' }}>
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
  iconWrap:  { alignItems: 'center', justifyContent: 'center' },
  activeBar: { height: 2, width: 20, borderRadius: 1, marginTop: 3 },
  label:     { fontSize: 10, letterSpacing: 0.3 },
  fabOuter: {
    position: 'absolute',
    top: -22,
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3D3426',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(61, 52, 38, 0.30)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 8,
  },
});

export default function Tabs() {
  const theme = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleAddItem = useCallback(() => {
    if (!user) {
      Alert.alert('Sign in required', 'Please sign in to add items.');
      return;
    }
    navigation.navigate('ClosetUpload');
  }, [user, navigation]);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => {
          if (route.name === 'AddItem') { return null; }
          return renderTabIcon(iconFor(route.name), color, focused, theme.colors.accent);
        },
        tabBarLabel: ({ focused, color }) => {
          if (route.name === 'AddItem') { return null; }
          return renderTabLabel(route.name, focused, color);
        },
        tabBarActiveTintColor:   theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.backgroundSecondary,
          borderTopColor:  theme.colors.border,
          borderTopWidth:  1,
          paddingBottom:   8,
          paddingTop:      10,
          height:          72,
          shadowColor:     'rgba(61, 52, 38, 0.10)',
          shadowOffset:    { width: 0, height: -2 },
          shadowOpacity:   1,
          shadowRadius:    12,
          elevation:       8,
        },
        tabBarItemStyle:      { paddingBottom: 0 },
        tabBarHideOnKeyboard: true,
      })}
    >
      <Tab.Screen name="Home"    component={HomeScreen} />
      <Tab.Screen name="Closet"  component={ClosetScreen} />
      <Tab.Screen
        name="AddItem"
        component={DummyScreen}
        options={{
          // eslint-disable-next-line react/no-unstable-nested-components
          tabBarButton: () => <AddItemTabButton onPress={handleAddItem} />,
        }}
      />
      <Tab.Screen name="Avatar"   component={Avatar3DScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
