import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { getCurrentUser, updateUserPrivacy, deleteAccount } from "../api/user";
import { useAuth } from "../context/AuthContext";

const P = {
  background:    "#F5F0E8",
  cardSurface:   "#EDE6D8",
  cardWhite:     "#FFFFFF",
  primaryText:   "#3D3426",
  secondaryText: "#8C7E6A",
  lightText:     "#B5A894",
  accent:        "#C4A882",
  border:        "#E8E0D0",
  danger:        "#C8706A",
  shadow:        "rgba(61, 52, 38, 0.08)",
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
  const { refreshUserFromBackend, logout } = useAuth();

  const [privacy, setPrivacy]   = useState<PrivacyState>(DEFAULT_PRIVACY);
  const [loading, setLoading]   = useState(true);
  const [savingKey, setSavingKey] = useState<keyof PrivacyState | null>(null);
  const [error, setError]       = useState<string | null>(null);

  // Password confirmation modal state
  const [showModal, setShowModal]       = useState(false);
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError]   = useState<string | null>(null);

  const getErrorMessage = (e: any, fallback: string) =>
    e?.message || e?.response?.data?.message || fallback;

  const loadPrivacy = async () => {
    const me = await getCurrentUser();
    const p = ((me as any).privacy ?? {}) as Partial<PrivacyState>;
    setPrivacy({
      profileVisible:    !!p.profileVisible,
      activityVisible:   !!p.activityVisible,
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
    return () => { mounted = false; };
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

  // Step 1: native confirmation alert
  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account?",
      "This action is permanent and will remove all your data including closet items, outfits, and calendar events.\n\nYou have 30 days to change your mind — just log back in to restore your account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            setPassword("");
            setDeleteError(null);
            setShowModal(true);
          },
        },
      ]
    );
  };

  // Step 2: password modal submission
  const handleConfirmDelete = async () => {
    if (!password.trim()) {
      setDeleteError("Please enter your password.");
      return;
    }
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteAccount(password);
      setShowModal(false);
      await logout();
    } catch (e: any) {
      const msg = e?.message || "Incorrect password. Please try again.";
      setDeleteError(msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  const closeModal = () => {
    if (deleteLoading) return;
    setShowModal(false);
    setPassword("");
    setDeleteError(null);
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
          {/* Privacy toggles */}
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

          {/* Danger Zone */}
          <View style={styles.dangerCard}>
            <Pressable
              style={({ pressed }) => [styles.dangerRow, pressed && { opacity: 0.7 }]}
              onPress={handleDeleteAccount}
            >
              <View style={styles.dangerIconWrap}>
                <Ionicons name="trash-outline" size={18} color={P.danger} />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={styles.dangerLabel}>Delete Account</Text>
                <Text style={styles.rowHelp}>Permanently delete your account and all data</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={P.danger} />
            </Pressable>
          </View>
        </ScrollView>
      )}

      {/* ── Password Confirmation Modal ─────────────────────────────────── */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeModal}>
          {/* Stop touches from closing when tapping inside the card */}
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {/* Icon */}
            <View style={styles.modalIconWrap}>
              <Ionicons name="lock-closed-outline" size={28} color={P.danger} />
            </View>

            <Text style={styles.modalTitle}>Confirm Deletion</Text>
            <Text style={styles.modalBody}>
              Enter your password to confirm. You can recover your account within{" "}
              <Text style={styles.modalBodyBold}>30 days</Text> by logging back in.
            </Text>

            {/* Password input */}
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Your password"
                placeholderTextColor={P.lightText}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(t) => { setPassword(t); setDeleteError(null); }}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!deleteLoading}
              />
              <Pressable
                style={styles.eyeBtn}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={P.lightText}
                />
              </Pressable>
            </View>

            {/* Error */}
            {deleteError ? (
              <Text style={styles.modalError}>{deleteError}</Text>
            ) : null}

            {/* Actions */}
            <Pressable
              style={[styles.deleteBtn, deleteLoading && { opacity: 0.6 }]}
              onPress={() => { void handleConfirmDelete(); }}
              disabled={deleteLoading}
            >
              {deleteLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.deleteBtnText}>Delete My Account</Text>
              )}
            </Pressable>

            <Pressable
              style={[styles.cancelBtn, deleteLoading && { opacity: 0.4 }]}
              onPress={closeModal}
              disabled={deleteLoading}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.background },
  center:    { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll:    { paddingHorizontal: 20, paddingBottom: 40 },

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
    backgroundColor: P.cardSurface,
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
    shadowColor: P.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
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
  rowLabel:   { color: P.primaryText,   fontSize: 15, fontWeight: "600" },
  rowHelp:    { color: P.secondaryText, fontSize: 12, marginTop: 2 },
  rowBorder:  { height: 1, backgroundColor: P.border, marginHorizontal: 16 },

  errorText: { color: P.danger, marginTop: 12, paddingHorizontal: 4, fontSize: 13 },

  dangerCard: {
    backgroundColor: P.cardWhite,
    borderWidth: 1,
    borderColor: P.danger,
    borderRadius: 18,
    overflow: "hidden",
    marginTop: 32,
    shadowColor: P.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
  },
  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  dangerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: `${P.danger}15`,
    justifyContent: "center",
    alignItems: "center",
  },
  dangerLabel: { color: P.danger, fontSize: 15, fontWeight: "600" },

  // ── Modal ────────────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(61, 52, 38, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    backgroundColor: P.cardWhite,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  modalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: `${P.danger}12`,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: P.primaryText,
    textAlign: "center",
  },
  modalBody: {
    fontSize: 14,
    color: P.secondaryText,
    textAlign: "center",
    lineHeight: 21,
  },
  modalBodyBold: { fontWeight: "700", color: P.primaryText },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: P.background,
    width: "100%",
    marginTop: 4,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: P.primaryText,
  },
  eyeBtn: { paddingLeft: 8 },

  modalError: {
    fontSize: 13,
    color: P.danger,
    textAlign: "center",
    alignSelf: "stretch",
  },

  deleteBtn: {
    width: "100%",
    backgroundColor: P.danger,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  deleteBtnText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },

  cancelBtn: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 15, color: P.secondaryText, fontWeight: "500" },
});
