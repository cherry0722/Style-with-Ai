/**
 * Information & Permissions screen.
 * Lets the user toggle device permissions (Camera, Photos, Location, Notifications, Microphone).
 * Each toggle triggers the native OS permission request via Expo APIs.
 * State is persisted on the backend.
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { Camera } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Audio } from "expo-av";
import { getUserPermissions, updateUserPermissions } from "../api/user";
import { useSettings } from "../store/settings";

/* ─── Palette (matches existing design system) ─── */
const P = {
  background: "#F5F0E8",
  cardWhite: "#FFFFFF",
  primaryText: "#3D3426",
  secondaryText: "#8C7E6A",
  lightText: "#B5A894",
  accent: "#C4A882",
  border: "#E8E0D0",
  danger: "#C8706A",
} as const;

/* ─── Permission keys ─── */
type PermissionKey = "camera" | "photos" | "location" | "notifications" | "microphone";

/* ─── Config for each row ─── */
interface PermissionItem {
  key: PermissionKey;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const PERMISSION_ITEMS: PermissionItem[] = [
  {
    key: "camera",
    title: "Camera Access",
    description: "Take photos to add clothing items to your wardrobe.",
    icon: "camera-outline",
  },
  {
    key: "photos",
    title: "Photo Library Access",
    description: "Select existing photos of your clothing items.",
    icon: "images-outline",
  },
  {
    key: "location",
    title: "Location Access",
    description: "Get weather-based outfit suggestions for your area.",
    icon: "location-outline",
  },
  {
    key: "notifications",
    title: "Notifications Access",
    description: "Receive daily outfit suggestions and reminders.",
    icon: "notifications-outline",
  },
  {
    key: "microphone",
    title: "Microphone Access",
    description: "Use voice commands to interact with MYRA.",
    icon: "mic-outline",
  },
];

/* ─── OS permission requesters ─── */
async function requestOSPermission(key: PermissionKey): Promise<boolean> {
  switch (key) {
    case "camera": {
      const { status } = await Camera.requestCameraPermissionsAsync();
      return status === "granted";
    }
    case "photos": {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      return status === "granted";
    }
    case "location": {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === "granted";
    }
    case "notifications": {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === "granted";
    }
    case "microphone": {
      const { status } = await Audio.requestPermissionsAsync();
      return status === "granted";
    }
    default:
      return false;
  }
}


/* ─── Map PermissionKey to store property names ─── */
const KEY_MAP: Record<PermissionKey, keyof ReturnType<typeof useSettings.getState>> = {
  camera: "cameraEnabled",
  photos: "photosEnabled",
  location: "locationEnabled",
  notifications: "notificationsEnabled",
  microphone: "microphoneEnabled",
};

/* ─── Component ─── */
export default function InformationPermissionsScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const settings = useSettings();

  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<PermissionKey | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getErrorMessage = (e: any, fallback: string) =>
    e?.response?.data?.message || e?.message || fallback;

  /* Load/Sync everything on mount or focus */
  useEffect(() => {
    let mounted = true;
    const sync = async () => {
      try {
        await Promise.all([
          settings.syncPermissions(),
          settings.refreshOSPermissions()
        ]);
      } catch (e: any) {
        if (mounted) setError(getErrorMessage(e, "Failed to load permissions."));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    if (isFocused) {
      sync();
    }
    return () => { mounted = false; };
  }, [isFocused]);

  /* Toggle handler */
  const onToggle = async (key: PermissionKey, next: boolean) => {
    const storeKey = KEY_MAP[key];
    setSavingKey(key);
    setError(null);

    // Get current OS status from store (it was refreshed on focus or previous toggle)
    const isGrantedInOS = settings.osStatus[key];

    if (next) {
      if (!isGrantedInOS) {
        try {
          const granted = await requestOSPermission(key);
          await settings.refreshOSPermissions(); // Update OS status in store immediately
          
          if (!granted) {
            Alert.alert(
              "Permission Denied",
              `Please enable ${PERMISSION_ITEMS.find((p) => p.key === key)?.title ?? key} in your device Settings to use this feature.`
            );
            setSavingKey(null);
            return;
          }
        } catch (e: any) {
          setError(getErrorMessage(e, "Failed to request permission."));
          setSavingKey(null);
          return;
        }
      }
      
      // Save backend & store
      try {
        await updateUserPermissions({ [key]: true });
        settings.updateSettings({ [storeKey]: true });
      } catch (e: any) {
        setError(getErrorMessage(e, "Failed to update preference."));
      }
    } else {
      try {
        await updateUserPermissions({ [key]: false });
        settings.updateSettings({ [storeKey]: false });
      } catch (e: any) {
        setError(getErrorMessage(e, "Failed to update preference."));
      }
    }
    setSavingKey(null);
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={P.primaryText} />
        </Pressable>
        <Text style={styles.pageTitle}>PERMISSIONS</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={P.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.introText}>
            MYRA uses these permissions to give you the best experience. You can turn them on or off
            at any time.
          </Text>

          <View style={styles.card}>
            {PERMISSION_ITEMS.map((item, idx) => {
              const storeKey = KEY_MAP[item.key] as keyof typeof settings;
              const appEnabled = !!settings[storeKey];
              const osGranted = !!settings.osStatus[item.key];
              // Switch reflects the user's app preference (what they want).
              // If appEnabled but OS hasn't granted, show a warning so they
              // know to allow it in system Settings.
              const switchValue = appEnabled;
              const showOSWarning = appEnabled && !osGranted;

              return (
                <React.Fragment key={item.key}>
                  <View style={styles.row}>
                    <View style={styles.rowIconWrap}>
                      <Ionicons name={item.icon} size={18} color={P.accent} />
                    </View>
                    <View style={styles.rowTextWrap}>
                      <Text style={styles.rowLabel}>{item.title}</Text>
                      <Text style={styles.rowHelp}>{item.description}</Text>
                      {showOSWarning && (
                        <Text style={styles.osWarning}>
                          Allow in device Settings to activate
                        </Text>
                      )}
                    </View>
                    <Switch
                      value={switchValue}
                      onValueChange={(v) => void onToggle(item.key, v)}
                      disabled={savingKey === item.key}
                      trackColor={{ false: P.border, true: `${P.accent}55` }}
                      thumbColor={switchValue ? P.accent : P.lightText}
                    />
                  </View>
                  {idx < PERMISSION_ITEMS.length - 1 && <View style={styles.rowBorder} />}
                </React.Fragment>
              );
            })}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <Text style={styles.footerNote}>
            You can also manage these permissions from your device's system Settings at any time.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ─── Styles (matches AccountPrivacyScreen + SettingsScreen patterns) ─── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { paddingHorizontal: 20, paddingBottom: 48 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#EDE6D8",
    justifyContent: "center",
    alignItems: "center",
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: P.primaryText,
    letterSpacing: -0.5,
  },
  introText: {
    fontSize: 13,
    color: P.secondaryText,
    lineHeight: 18,
    marginBottom: 16,
  },
  card: {
    backgroundColor: P.cardWhite,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "rgba(61, 52, 38, 0.08)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: `${P.accent}15`,
    justifyContent: "center",
    alignItems: "center",
  },
  rowTextWrap: { flex: 1 },
  rowLabel: { color: P.primaryText, fontSize: 15, fontWeight: "600" },
  rowHelp: { color: P.secondaryText, fontSize: 12, marginTop: 2 },
  rowBorder: { height: 1, backgroundColor: P.border, marginHorizontal: 16 },
  errorText: {
    color: P.danger,
    marginTop: 12,
    paddingHorizontal: 4,
    fontSize: 13,
  },
  footerNote: {
    fontSize: 12,
    color: P.lightText,
    marginTop: 16,
    textAlign: "center",
    lineHeight: 17,
  },
  osWarning: {
    fontSize: 11,
    color: P.danger,
    marginTop: 3,
  },
});
