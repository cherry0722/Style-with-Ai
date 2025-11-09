import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../store/settings";
import { useTheme } from "../context/ThemeContext";
import { hapticFeedback } from "../utils/haptics";
import { Picker } from '@react-native-picker/picker';
import type { BodyType, Pronouns } from "../types";

const PRONOUNS: Pronouns[] = ["she/her", "he/him", "they/them", "prefer-not-to-say"];
const BODY_TYPES: BodyType[] = ["skinny", "fit", "muscular", "bulk", "pear", "hourglass", "rectangle"];

export default function SettingsScreen() {
  const auth = useAuth();
  const { user } = auth;
  const updateProfile = auth.updateProfile;
  const settings = useSettings();
  const theme = useTheme();
  const p = (user?.profile ?? {}) as { preferredName?: string; pronouns?: Pronouns; heightCm?: number; weightLb?: number; bodyType?: BodyType };

  // View/edit mode
  const [editing, setEditing] = useState(false);
  const [showHeightPicker, setShowHeightPicker] = useState(false);
  const [showWeightPicker, setShowWeightPicker] = useState(false);

  // Editable copies
  const [preferredName, setPreferredName] = useState(p.preferredName || "");
  const [pronouns, setPronouns] = useState<Pronouns | undefined>(p.pronouns);
  const [heightCm, setHeightCm] = useState<number | undefined>(p.heightCm);
  const [weightLb, setWeightLb] = useState<number | undefined>(p.weightLb);
  const [bodyType, setBodyType] = useState<BodyType | undefined>(p.bodyType);

  function startEdit() {
    setPreferredName(p.preferredName || "");
    setPronouns(p.pronouns);
    setHeightCm(p.heightCm);
    setWeightLb(p.weightLb);
    setBodyType(p.bodyType);
    setEditing(true);
  }

  function cancelEdit() {
    setPreferredName(p.preferredName || "");
    setPronouns(p.pronouns);
    setHeightCm(p.heightCm);
    setWeightLb(p.weightLb);
    setBodyType(p.bodyType);
    setEditing(false);
  }

  function saveEdit() {
    hapticFeedback.success();
    updateProfile?.({
      profile: {
        preferredName: preferredName || undefined,
        pronouns,
        heightCm,
        weightLb,
        bodyType,
      },
    } as any);
    setEditing(false);
  }

  const formatHeight = (cm: number) => {
    const feet = Math.floor(cm / 30.48);
    const inches = Math.round((cm % 30.48) / 2.54);
    return `${feet}'${inches}" (${cm} cm)`;
  };

  const formatWeight = (lb: number) => {
    const kg = Math.round(lb * 0.453592);
    return `${lb} lb (${kg} kg)`;
  };

  const createStyles = (theme: any) => ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollView: {
      flex: 1,
    },
    header: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing['2xl'],
      paddingBottom: theme.spacing.lg,
    },
    title: {
      fontSize: theme.typography['2xl'],
      fontWeight: theme.typography.bold,
      color: theme.colors.textPrimary,
    },
    editButton: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.accent + '10',
    },
    editButtonText: {
      fontSize: theme.typography.sm,
      fontWeight: theme.typography.medium,
      color: theme.colors.accent,
    },
    actionButtons: {
      flexDirection: 'row' as const,
      gap: theme.spacing.sm,
    },
    cancelButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cancelButtonText: {
      fontSize: theme.typography.sm,
      fontWeight: theme.typography.medium,
      color: theme.colors.textSecondary,
    },
    saveButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.accent,
    },
    saveButtonText: {
      fontSize: theme.typography.sm,
      fontWeight: theme.typography.medium,
      color: theme.colors.white,
    },
    section: {
      marginHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
    },
    sectionTitle: {
      fontSize: theme.typography.lg,
      fontWeight: theme.typography.bold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.lg,
    },
    settingItem: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      ...theme.shadows.sm,
    },
    settingLeft: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.accent + '10',
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      marginRight: theme.spacing.md,
    },
    settingContent: {
      flex: 1,
    },
    settingLabel: {
      fontSize: theme.typography.base,
      fontWeight: theme.typography.medium,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    settingValue: {
      fontSize: theme.typography.sm,
      color: theme.colors.textSecondary,
    },
    readOnlyValue: {
      color: theme.colors.textTertiary,
    },
    valueContainer: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
    },
    input: {
      fontSize: theme.typography.sm,
      color: theme.colors.textPrimary,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.backgroundTertiary,
    },
    chipsContainer: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: theme.spacing.sm,
    },
    chip: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.backgroundTertiary,
    },
    chipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    chipText: {
      fontSize: theme.typography.sm,
      fontWeight: theme.typography.medium,
      color: theme.colors.textSecondary,
    },
    chipTextActive: {
      color: theme.colors.white,
    },
    toggleContainer: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
    },
    pickerModal: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    pickerHeader: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    pickerCancel: {
      fontSize: theme.typography.base,
      color: theme.colors.textSecondary,
    },
    pickerTitle: {
      fontSize: theme.typography.lg,
      fontWeight: theme.typography.bold,
      color: theme.colors.textPrimary,
    },
    pickerDone: {
      fontSize: theme.typography.base,
      color: theme.colors.accent,
      fontWeight: theme.typography.bold,
    },
    pickerContainer: {
      flex: 1,
      justifyContent: 'center' as const,
    },
    picker: {
      height: 200,
    },
  });

  const styles = createStyles(theme);

  // Setting Item Component
  function SettingItem({
    icon,
    label,
    value,
    readOnly = false,
    editable = false,
    type = 'text',
    inputValue,
    onInputChange,
    placeholder,
    options,
    selectedValue,
    onValueChange,
    toggleValue,
    onToggle,
    onPress,
  }: {
    icon: string;
    label: string;
    value?: string;
    readOnly?: boolean;
    editable?: boolean;
    type?: 'text' | 'chips' | 'toggle' | 'picker';
    inputValue?: string;
    onInputChange?: (value: string) => void;
    placeholder?: string;
    options?: string[];
    selectedValue?: any;
    onValueChange?: (value: any) => void;
    toggleValue?: boolean;
    onToggle?: () => void;
    onPress?: () => void;
  }) {
    return (
      <View style={styles.settingItem}>
        <View style={styles.settingLeft}>
          <View style={styles.iconContainer}>
            <Ionicons name={icon as any} size={20} color={theme.colors.accent} />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>{label}</Text>
            {type === 'text' && editable && onInputChange ? (
              <TextInput
                style={styles.input}
                value={inputValue}
                onChangeText={onInputChange}
                placeholder={placeholder}
                placeholderTextColor={theme.colors.textTertiary}
              />
            ) : type === 'chips' && editable && options ? (
              <View style={styles.chipsContainer}>
                {options.map((option) => (
                  <Pressable
                    key={option}
                    style={[
                      styles.chip,
                      selectedValue === option && styles.chipActive,
                    ]}
                    onPress={() => {
                      hapticFeedback.light();
                      onValueChange?.(option);
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedValue === option && styles.chipTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : type === 'toggle' ? (
              <View style={styles.toggleContainer}>
                <Text style={styles.settingValue}>{value}</Text>
                <Switch
                  value={toggleValue}
                  onValueChange={onToggle}
                  trackColor={{ false: theme.colors.gray200, true: theme.colors.accent + '40' }}
                  thumbColor={toggleValue ? theme.colors.accent : theme.colors.gray400}
                />
              </View>
            ) : (
              <Pressable
                style={styles.valueContainer}
                onPress={editable ? onPress : undefined}
                disabled={!editable}
              >
                <Text style={[styles.settingValue, !editable && styles.readOnlyValue]}>
                  {value}
                </Text>
                {editable && type === 'picker' && (
                  <Ionicons name="chevron-down" size={16} color={theme.colors.textTertiary} />
                )}
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        {!editing ? (
            <Pressable style={styles.editButton} onPress={startEdit}>
              <Ionicons name="create-outline" size={20} color={theme.colors.accent} />
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          ) : (
            <View style={styles.actionButtons}>
              <Pressable style={styles.cancelButton} onPress={cancelEdit}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={saveEdit}>
                <Text style={styles.saveButtonText}>Save</Text>
            </Pressable>
          </View>
        )}
      </View>

        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Information</Text>
          
          {/* Email (Read-only) */}
          <SettingItem
            icon="mail-outline"
            label="Email"
            value={user?.email || "—"}
            readOnly
          />

          {/* Preferred Name */}
          <SettingItem
            icon="person-outline"
            label="Preferred Name"
            value={editing ? undefined : (p.preferredName || "—")}
            editable={editing}
            inputValue={preferredName}
            onInputChange={setPreferredName}
            placeholder="Enter your name"
          />

          {/* Pronouns */}
          <SettingItem
            icon="people-outline"
            label="Pronouns"
            value={pronouns || p.pronouns || "—"}
            editable={editing}
            type="chips"
            options={PRONOUNS}
            selectedValue={pronouns}
            onValueChange={setPronouns}
          />
        </View>

        {/* Measurements Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Measurements</Text>
          
          {/* Height */}
          <SettingItem
            icon="resize-outline"
            label="Height"
            value={heightCm ? formatHeight(heightCm) : (p.heightCm ? formatHeight(p.heightCm) : "—")}
            editable={editing}
            type="picker"
            onPress={() => setShowHeightPicker(true)}
          />

          {/* Weight */}
          <SettingItem
            icon="fitness-outline"
            label="Weight"
            value={weightLb ? formatWeight(weightLb) : (p.weightLb ? formatWeight(p.weightLb) : "—")}
            editable={editing}
            type="picker"
            onPress={() => setShowWeightPicker(true)}
          />

          {/* Body Type */}
          <SettingItem
            icon="body-outline"
            label="Body Type"
            value={bodyType || p.bodyType || "—"}
            editable={editing}
            type="chips"
            options={BODY_TYPES}
            selectedValue={bodyType}
            onValueChange={setBodyType}
          />
        </View>

        {/* App Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Preferences</Text>
          
          {/* Temperature Unit */}
          <SettingItem
            icon="thermometer-outline"
            label="Temperature Unit"
            value={settings.temperatureUnit === 'celsius' ? 'Celsius (°C)' : 'Fahrenheit (°F)'}
            type="toggle"
            toggleValue={settings.temperatureUnit === 'fahrenheit'}
            onToggle={() => {
              hapticFeedback.light();
              settings.toggleTemperatureUnit();
            }}
          />

          {/* Notifications */}
          <SettingItem
            icon="notifications-outline"
            label="Notifications"
            value={settings.notificationsEnabled ? 'Enabled' : 'Disabled'}
            type="toggle"
            toggleValue={settings.notificationsEnabled}
            onToggle={() => {
              hapticFeedback.light();
              settings.toggleNotifications();
            }}
      />
    </View>
      </ScrollView>

      {/* Height Picker Modal */}
      <Modal
        visible={showHeightPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowHeightPicker(false)}
      >
        <View style={styles.pickerModal}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={() => setShowHeightPicker(false)}>
              <Text style={styles.pickerCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.pickerTitle}>Select Height</Text>
            <Pressable onPress={() => setShowHeightPicker(false)}>
              <Text style={styles.pickerDone}>Done</Text>
            </Pressable>
          </View>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={heightCm || 170}
              onValueChange={(value) => setHeightCm(value)}
              style={styles.picker}
            >
              {Array.from({ length: 71 }, (_, i) => i + 140).map((cm) => (
                <Picker.Item
                  key={cm}
                  label={formatHeight(cm)}
                  value={cm}
                />
              ))}
            </Picker>
          </View>
        </View>
      </Modal>

      {/* Weight Picker Modal */}
      <Modal
        visible={showWeightPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowWeightPicker(false)}
      >
        <View style={styles.pickerModal}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={() => setShowWeightPicker(false)}>
              <Text style={styles.pickerCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.pickerTitle}>Select Weight</Text>
            <Pressable onPress={() => setShowWeightPicker(false)}>
              <Text style={styles.pickerDone}>Done</Text>
            </Pressable>
          </View>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={weightLb || 150}
              onValueChange={(value) => setWeightLb(value)}
              style={styles.picker}
            >
              {Array.from({ length: 261 }, (_, i) => i + 90).map((lb) => (
                <Picker.Item
                  key={lb}
                  label={formatWeight(lb)}
                  value={lb}
                />
              ))}
            </Picker>
          </View>
        </View>
      </Modal>
    </View>
  );
}