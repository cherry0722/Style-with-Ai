import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from "@react-navigation/native";
import { changePassword } from "../api/user";

const P = {
  background: "#F5F0E8",
  cardWhite: "#FFFFFF",
  primaryText: "#3D3426",
  secondaryText: "#8C7E6A",
  lightText: "#B5A894",
  accent: "#C4A882",
  border: "#E8E0D0",
  danger: "#C8706A",
  success: "#4C8C61",
} as const;

export default function PasswordAndSecurityScreen() {
  const navigation = useNavigation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const getErrorMessage = (e: any, fallback: string) =>
    e?.response?.data?.message || e?.message || fallback;

  const onSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!currentPassword || !newPassword) {
      setError("Current password and new password are required.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setSuccess("Password changed successfully.");
    } catch (e: any) {
      setError(getErrorMessage(e, "Failed to change password."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={P.primaryText} />
        </Pressable>
        <Text style={styles.pageTitle}>PASSWORD & SECURITY</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.label}>Current Password</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="Enter current password"
            placeholderTextColor={P.lightText}
          />

          <Text style={styles.label}>New Password</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="Enter new password"
            placeholderTextColor={P.lightText}
          />

          <Text style={styles.label}>Confirm New Password</Text>
          <TextInput
            style={styles.input}
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="Confirm new password"
            placeholderTextColor={P.lightText}
          />

          <Pressable
            style={({ pressed }) => [styles.submitButton, (pressed || loading) && { opacity: 0.85 }]}
            onPress={() => void onSubmit()}
            disabled={loading}
          >
            <Text style={styles.submitText}>{loading ? "Saving..." : "Change Password"}</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {success ? <Text style={styles.successText}>{success}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.background },
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
  content: { paddingHorizontal: 20 },
  card: {
    backgroundColor: P.cardWhite,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 18,
    padding: 16,
  },
  label: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: P.secondaryText,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: P.primaryText,
    backgroundColor: P.background,
  },
  submitButton: {
    marginTop: 18,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: P.accent,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  errorText: {
    color: P.danger,
    marginTop: 12,
    fontSize: 13,
    paddingHorizontal: 4,
  },
  successText: {
    color: P.success,
    marginTop: 12,
    fontSize: 13,
    paddingHorizontal: 4,
  },
});
