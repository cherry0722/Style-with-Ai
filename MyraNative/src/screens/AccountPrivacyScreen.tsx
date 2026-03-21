import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { getCurrentUser, updateUserPrivacy } from "../api/user";
import { useAuth } from "../context/AuthContext";

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

type PrivacyState = {
  profileVisible: boolean;
  activityVisible: boolean;
  dataSharingConsent: boolean;
};

const DEFAULT_PRIVACY: PrivacyState = {
  profileVisible: false,
  activityVisible: false,
  dataSharingConsent: false,
};

export default function AccountPrivacyScreen() {
  const navigation = useNavigation();
  const { refreshUserFromBackend } = useAuth();
  const [privacy, setPrivacy] = useState<PrivacyState>(DEFAULT_PRIVACY);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<keyof PrivacyState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getErrorMessage = (e: any, fallback: string) =>
    e?.response?.data?.message || e?.message || fallback;

  const loadPrivacy = async () => {
    const me = await getCurrentUser();
    const p = ((me as any).privacy ?? {}) as Partial<PrivacyState>;
    setPrivacy({
      profileVisible: !!p.profileVisible,
      activityVisible: !!p.activityVisible,
      dataSharingConsent: !!p.dataSharingConsent,
    });
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await loadPrivacy();
      } catch (e: any) {
        if (mounted) setError(getErrorMessage(e, "Failed to load privacy settings."));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onToggle = async (key: keyof PrivacyState, next: boolean) => {
    const prev = privacy;
    setPrivacy((p) => ({ ...p, [key]: next }));
    setSavingKey(key);
    setError(null);
    try {
      await updateUserPrivacy({ [key]: next });
      await loadPrivacy();
      await refreshUserFromBackend?.();
    } catch (e: any) {
      setPrivacy(prev);
      setError(getErrorMessage(e, "Failed to save privacy setting."));
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={P.primaryText} />
        </Pressable>
        <Text style={styles.pageTitle}>ACCOUNT PRIVACY</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={P.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowLabel}>Profile Visible</Text>
                <Text style={styles.rowHelp}>Allow others to view your profile details.</Text>
              </View>
              <Switch
                value={privacy.profileVisible}
                onValueChange={(v) => void onToggle("profileVisible", v)}
                disabled={savingKey === "profileVisible"}
                trackColor={{ false: P.border, true: `${P.accent}55` }}
                thumbColor={privacy.profileVisible ? P.accent : P.lightText}
              />
            </View>

            <View style={styles.rowBorder} />

            <View style={styles.row}>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowLabel}>Activity Visible</Text>
                <Text style={styles.rowHelp}>Allow others to view your account activity.</Text>
              </View>
              <Switch
                value={privacy.activityVisible}
                onValueChange={(v) => void onToggle("activityVisible", v)}
                disabled={savingKey === "activityVisible"}
                trackColor={{ false: P.border, true: `${P.accent}55` }}
                thumbColor={privacy.activityVisible ? P.accent : P.lightText}
              />
            </View>

            <View style={styles.rowBorder} />

            <View style={styles.row}>
              <View style={styles.rowTextWrap}>
                <Text style={styles.rowLabel}>Data Sharing Consent</Text>
                <Text style={styles.rowHelp}>Allow anonymous usage data sharing to improve the app.</Text>
              </View>
              <Switch
                value={privacy.dataSharingConsent}
                onValueChange={(v) => void onToggle("dataSharingConsent", v)}
                disabled={savingKey === "dataSharingConsent"}
                trackColor={{ false: P.border, true: `${P.accent}55` }}
                thumbColor={privacy.dataSharingConsent ? P.accent : P.lightText}
              />
            </View>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { paddingHorizontal: 20, paddingBottom: 24 },
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
  card: {
    backgroundColor: P.cardWhite,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 18,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
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
});
