import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { saveUserProfile } from "../api/user";

type RootNav = NativeStackNavigationProp<RootStackParamList>;

type Gender = "female" | "male" | "other";

export default function OnboardingProfileScreen() {
  const navigation = useNavigation<RootNav>();
  const { user, updateProfile } = useAuth();
  const theme = useTheme();

  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const styles = createStyles(theme);

  // Redirect defensively if there is no user (should only come here right after signup)
  useEffect(() => {
    console.log("[OnboardingProfile] Mounted with user:", user);
    if (!user) {
      navigation.reset({
        index: 0,
        routes: [{ name: "Login" }],
      });
    }
  }, [user, navigation]);

  const parseNumber = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const parsedAge = parseNumber(age);
    const parsedHeight = parseNumber(height);
    const parsedWeight = parseNumber(weight);

    if (!parsedAge || parsedAge <= 0) {
      setError("Please enter a valid age.");
      return;
    }
    if (!gender) {
      setError("Please select a gender.");
      return;
    }
    if (!parsedHeight || parsedHeight <= 0) {
      setError("Please enter a valid height.");
      return;
    }
    if (!parsedWeight || parsedWeight <= 0) {
      setError("Please enter a valid weight.");
      return;
    }
    if (!agreed) {
      setError("Please agree to personalization to continue.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      console.log("[Onboarding] Sending profile to backend...", {
        age: parsedAge,
        gender,
        heightCm: parsedHeight,
        weightLb: parsedWeight,
      });

      const response = await saveUserProfile({
        age: parsedAge,
        gender,
        heightCm: parsedHeight,
        weightLb: parsedWeight,
      });

      console.log(
        "[Onboarding] Backend saved profile:",
        JSON.stringify(response.data)
      );

      if (response.status !== 200 && !response.data?.success) {
        console.error(
          "[Onboarding] Backend did not confirm success:",
          response.status,
          response.data
        );
        setError("Failed to save your profile. Please try again.");
        return;
      }

      // Store these fields under the user's profile, consistent with SettingsScreen
      updateProfile?.({
        profile: {
          ...(user?.profile ?? {}),
          age: parsedAge,
          gender,
          heightCm: parsedHeight,
          weightLb: parsedWeight,
        },
      } as any);

      navigation.reset({
        index: 0,
        routes: [{ name: "Main" }],
      });
    } catch (err: any) {
      console.error("[Onboarding] Error saving profile:", err);
      setError(
        err?.message ||
          "Unable to save your profile right now. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitDisabled =
    submitting ||
    !age.trim() ||
    !height.trim() ||
    !weight.trim() ||
    !gender ||
    !agreed;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>Complete your style profile</Text>
              <Text style={styles.subtitle}>
                We'll tailor outfits to your age, body, and preferences.
              </Text>
            </View>

            {error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Age */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                value={age}
                onChangeText={(text) => {
                  setAge(text);
                  if (error) setError("");
                }}
                keyboardType="number-pad"
                placeholder="E.g. 22"
                placeholderTextColor={theme.colors.textTertiary}
                style={styles.input}
              />
            </View>

            {/* Gender */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Gender</Text>
              <View style={styles.genderRow}>
                {[
                  { key: "female", label: "Female" },
                  { key: "male", label: "Male" },
                  { key: "other", label: "Other" },
                ].map((option) => {
                  const selected = gender === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.genderChip,
                        selected && styles.genderChipActive,
                      ]}
                      onPress={() => {
                        setGender(option.key as Gender);
                        if (error) setError("");
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[
                          styles.genderChipText,
                          selected && styles.genderChipTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Height */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput
                value={height}
                onChangeText={(text) => {
                  setHeight(text);
                  if (error) setError("");
                }}
                keyboardType="number-pad"
                placeholder="E.g. 175"
                placeholderTextColor={theme.colors.textTertiary}
                style={styles.input}
              />
            </View>

            {/* Weight */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Weight (lb)</Text>
              <TextInput
                value={weight}
                onChangeText={(text) => {
                  setWeight(text);
                  if (error) setError("");
                }}
                keyboardType="number-pad"
                placeholder="E.g. 160"
                placeholderTextColor={theme.colors.textTertiary}
                style={styles.input}
              />
            </View>

            {/* Consent */}
            <TouchableOpacity
              style={styles.consentRow}
              onPress={() => {
                setAgreed((prev) => !prev);
                if (error) setError("");
              }}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.consentCheckbox,
                  agreed && styles.consentCheckboxChecked,
                ]}
              >
                {agreed && (
                  <View style={styles.consentCheckboxInner} />
                )}
              </View>
              <Text style={styles.consentText}>
                I agree to MYRA using this info to personalize my outfit suggestions.
              </Text>
            </TouchableOpacity>

            {/* Primary button */}
            <TouchableOpacity
              onPress={handleSubmit}
              activeOpacity={0.8}
              disabled={isSubmitDisabled}
              style={[
                styles.primaryButton,
                isSubmitDisabled && styles.primaryButtonDisabled,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                Save &amp; Continue
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing["2xl"],
      justifyContent: "center",
    },
    card: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius["2xl"],
      padding: theme.spacing["2xl"],
      ...theme.shadows.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      maxWidth: 480,
      alignSelf: "center",
      width: "100%",
    },
    header: {
      marginBottom: theme.spacing["2xl"],
      alignItems: "center",
    },
    title: {
      fontSize: theme.typography["2xl"],
      fontWeight: theme.typography.bold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
      textAlign: "center",
    },
    subtitle: {
      fontSize: theme.typography.sm,
      color: theme.colors.textSecondary,
      textAlign: "center",
      lineHeight: theme.typography.sm * theme.typography.lineHeight,
    },
    errorContainer: {
      backgroundColor: theme.colors.error + "15",
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    errorText: {
      fontSize: theme.typography.sm,
      color: theme.colors.error,
    },
    fieldGroup: {
      marginBottom: theme.spacing.lg,
    },
    label: {
      fontSize: theme.typography.sm,
      fontWeight: theme.typography.medium,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    input: {
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.background,
      fontSize: theme.typography.base,
      color: theme.colors.textPrimary,
    },
    genderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    genderChip: {
      flex: 1,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      alignItems: "center",
    },
    genderChipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    genderChipText: {
      fontSize: theme.typography.sm,
      fontWeight: theme.typography.medium,
      color: theme.colors.textSecondary,
    },
    genderChipTextActive: {
      color: theme.colors.white,
    },
    consentRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
    },
    consentCheckbox: {
      width: 20,
      height: 20,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    consentCheckboxChecked: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.accent + "20",
    },
    consentCheckboxInner: {
      width: 12,
      height: 12,
      borderRadius: theme.borderRadius.xs,
      backgroundColor: theme.colors.accent,
    },
    consentText: {
      flex: 1,
      fontSize: theme.typography.sm,
      color: theme.colors.textSecondary,
      lineHeight: theme.typography.sm * theme.typography.lineHeight,
    },
    primaryButton: {
      marginTop: theme.spacing.lg,
      backgroundColor: theme.colors.accent,
      borderRadius: 999,
      minHeight: 56,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonDisabled: {
      opacity: 0.5,
    },
    primaryButtonText: {
      fontSize: theme.typography.lg,
      fontWeight: theme.typography.bold,
      color: theme.colors.white,
    },
  });


