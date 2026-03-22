/**
 * Settings Screen — structured sections with icon rows and chevrons.
 * Profile edit (name, pronouns, body) and preferences expand inline.
 * Log out has a confirmation dialog. Text size from Accessibility is respected.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../store/settings';
import { saveUserProfile } from '../api/user';
import { hapticFeedback } from '../utils/haptics';
import { useTextScale } from '../utils/textSize';
import { Picker } from '@react-native-picker/picker';
import type { BodyType, Pronouns } from '../types';

const P = {
  background:    '#F5F0E8',
  cardSurface:   '#EDE6D8',
  cardWhite:     '#FFFFFF',
  primaryText:   '#3D3426',
  secondaryText: '#8C7E6A',
  lightText:     '#B5A894',
  accent:        '#C4A882',
  border:        '#E8E0D0',
  shadow:        'rgba(61, 52, 38, 0.08)',
  danger:        '#C8706A',
} as const;

const PRONOUNS:   Pronouns[]  = ['she/her', 'he/him', 'they/them', 'prefer-not-to-say'];
const BODY_TYPES: BodyType[]  = ['skinny', 'fit', 'muscular', 'bulk', 'pear', 'hourglass', 'rectangle'];
const APP_VERSION = '1.0.0';

function SettingsRow({
  icon, label, value, onPress, danger, last, fs,
}: Readonly<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
  fs: (base: number) => number;
}>) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { opacity: 0.75 }]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={[styles.rowIconWrap, danger && styles.rowIconWrapDanger]}>
        <Ionicons name={icon} size={18} color={danger ? P.danger : P.accent} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, danger && { color: P.danger }, { fontSize: fs(15) }]}>{label}</Text>
        {!!value && <Text style={[styles.rowValue, { fontSize: fs(12) }]} numberOfLines={1}>{value}</Text>}
      </View>
      {onPress && (
        <Ionicons name="chevron-forward" size={16} color={P.lightText} />
      )}
    </Pressable>
  );
}

function ChipSelector<T extends string>({
  options, value, onChange,
}: Readonly<{ options: readonly T[]; value: T | undefined; onChange: (v: T) => void }>) {
  return (
    <View style={styles.chips}>
      {options.map((opt) => (
        <Pressable
          key={opt}
          style={[styles.chip, value === opt && styles.chipActive]}
          onPress={() => { hapticFeedback.light(); onChange(opt); }}
        >
          <Text style={[styles.chipText, value === opt && styles.chipTextActive]}>{opt}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function SectionHeader({ title, fs }: Readonly<{ title: string; fs: (base: number) => number }>) {
  return <Text style={[styles.sectionTitle, { fontSize: fs(11) }]}>{title}</Text>;
}

export default function SettingsScreen() {
  const navigation = useNavigation();
  const auth = useAuth();
  const { user, logout, refreshUserFromBackend } = auth;
  const updateProfile = auth.updateProfile;
  const settings = useSettings();
  const isFocused = useIsFocused();
  const fs = useTextScale();

  useEffect(() => {
    if (isFocused) {
      settings.refreshOSPermissions();
    }
  }, [isFocused]);

  const p = (user?.profile ?? {}) as {
    preferredName?: string;
    pronouns?: Pronouns;
    heightCm?: number;
    weightLb?: number;
    bodyType?: BodyType;
  };

  const [expanded, setExpanded] = useState<'personalDetails' | null>(null);

  const [preferredName, setPreferredName] = useState(p.preferredName ?? '');
  const [pronouns,      setPronouns]      = useState<Pronouns | undefined>(p.pronouns);
  const [heightCm,      setHeightCm]      = useState<number | undefined>(p.heightCm);
  const [weightLb,      setWeightLb]      = useState<number | undefined>(p.weightLb);
  const [bodyType,      setBodyType]      = useState<BodyType | undefined>(p.bodyType);
  const [showHeightPicker, setShowHeightPicker] = useState(false);
  const [showWeightPicker, setShowWeightPicker] = useState(false);

  const [versionTaps, setVersionTaps] = useState(0);
  const showDevSection = versionTaps >= 5;

  const toggleSection = (section: 'personalDetails') => {
    if (expanded === section) {
      setExpanded(null);
    } else {
      setPreferredName(p.preferredName ?? '');
      setPronouns(p.pronouns);
      setHeightCm(p.heightCm);
      setWeightLb(p.weightLb);
      setBodyType(p.bodyType);
      setExpanded(section);
    }
  };

  const saveProfile = async () => {
    try {
      await saveUserProfile({
        preferredName: preferredName.trim() || undefined,
        pronouns: pronouns ?? undefined,
        bodyType: bodyType ?? undefined,
        heightCm: heightCm ?? undefined,
        weightLb: weightLb ?? undefined,
      });
      hapticFeedback.success();
      await refreshUserFromBackend?.();
      setExpanded(null);
    } catch (_) {
      updateProfile?.({ profile: { preferredName: preferredName || undefined, pronouns, heightCm, weightLb, bodyType } } as any);
      setExpanded(null);
    }
  };

  // Task 4 — confirmation dialog before logging out
  const handleLogout = () => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out of MYRA?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: () => void logout(),
        },
      ],
    );
  };

  const formatHeight = (cm: number) => {
    const feet   = Math.floor(cm / 30.48);
    const inches = Math.round((cm % 30.48) / 2.54);
    return `${feet}'${inches}" (${cm} cm)`;
  };
  const formatWeight = (lb: number) => `${lb} lb (${Math.round(lb * 0.453592)} kg)`;

  // Task 5 — subtitle values for Accessibility and Activity rows
  const textSizeLabel = { small: 'Small', medium: 'Medium', large: 'Large' }[settings.textSize ?? 'medium'];
  const tempLabel     = settings.temperatureUnit === 'fahrenheit' ? 'Fahrenheit' : 'Celsius';
  const accessibilitySubtitle = `${textSizeLabel} · ${tempLabel}`;

  // Display name for the profile header
  const displayName = p.preferredName || (user as any)?.username || (user as any)?.email?.split('@')[0] || 'Your Profile';
  const displayEmail = (user as any)?.email ?? '';

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={P.primaryText} />
          </Pressable>
          <Text style={[styles.pageTitle, { fontSize: fs(30) }]}>SETTINGS</Text>
        </View>

        {/* Task 3 — Profile identity card at the top */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { fontSize: fs(16) }]} numberOfLines={1}>{displayName}</Text>
            {!!displayEmail && (
              <Text style={[styles.profileEmail, { fontSize: fs(12) }]} numberOfLines={1}>{displayEmail}</Text>
            )}
          </View>
        </View>

        {/* MY ACCOUNT */}
        <SectionHeader title="My Account" fs={fs} />
        <View style={styles.card}>
          <SettingsRow
            fs={fs}
            icon="lock-closed-outline"
            label="Password and Security"
            onPress={() => {
              // @ts-expect-error string-based navigation for mixed stack/tab routes
              (navigation as any).navigate("PasswordAndSecurity");
            }}
          />
          <SettingsRow
            fs={fs}
            icon="person-outline"
            label="Personal Details"
            value={p.preferredName ?? 'Set your name'}
            onPress={() => toggleSection('personalDetails')}
          />
          {expanded === 'personalDetails' && (
            <View style={styles.inlinePanel}>
              <Text style={[styles.inlineLabel, { fontSize: fs(11) }]}>Preferred Name</Text>
              <TextInput
                style={[styles.inlineInput, { fontSize: fs(14) }]}
                value={preferredName}
                onChangeText={setPreferredName}
                placeholder="Enter name"
                placeholderTextColor={P.lightText}
              />

              <Text style={[styles.inlineLabel, { fontSize: fs(11) }]}>Pronouns</Text>
              <ChipSelector options={PRONOUNS} value={pronouns} onChange={setPronouns} />

              <Text style={[styles.inlineLabel, { fontSize: fs(11) }]}>Body Type</Text>
              <ChipSelector options={BODY_TYPES} value={bodyType} onChange={setBodyType} />

              <Text style={[styles.inlineLabel, { fontSize: fs(11) }]}>Height</Text>
              <Pressable style={styles.inlinePickerRow} onPress={() => setShowHeightPicker(true)}>
                <Text style={[styles.inlinePickerValue, { fontSize: fs(14) }]}>{heightCm ? formatHeight(heightCm) : '—'}</Text>
                <Ionicons name="chevron-down" size={14} color={P.lightText} />
              </Pressable>

              <Text style={[styles.inlineLabel, { fontSize: fs(11) }]}>Weight</Text>
              <Pressable style={styles.inlinePickerRow} onPress={() => setShowWeightPicker(true)}>
                <Text style={[styles.inlinePickerValue, { fontSize: fs(14) }]}>{weightLb ? formatWeight(weightLb) : '—'}</Text>
                <Ionicons name="chevron-down" size={14} color={P.lightText} />
              </Pressable>

              <View style={styles.inlineActions}>
                <Pressable style={styles.cancelBtn} onPress={() => setExpanded(null)}>
                  <Text style={[styles.cancelBtnText, { fontSize: fs(14) }]}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.saveBtn} onPress={saveProfile}>
                  <Text style={[styles.saveBtnText, { fontSize: fs(14) }]}>Save</Text>
                </Pressable>
              </View>
            </View>
          )}
          <SettingsRow
            fs={fs}
            icon="document-text-outline"
            label="Information & Permissions"
            onPress={() => {
              // @ts-expect-error string-based navigation for mixed stack/tab routes
              (navigation as any).navigate("InformationPermissions");
            }}
          />
          <SettingsRow
            fs={fs}
            icon="shield-outline"
            label="Account Privacy"
            onPress={() => {
              // @ts-expect-error string-based navigation for mixed stack/tab routes
              (navigation as any).navigate("AccountPrivacy");
            }}
            last
          />
        </View>

        {/* MYRA */}
        <SectionHeader title="MYRA" fs={fs} />
        <View style={styles.card}>
          <SettingsRow
            fs={fs}
            icon="bookmark-outline"
            label="Saved"
            onPress={() => {
              // @ts-expect-error string-based navigation for mixed stack/tab routes
              (navigation as any).navigate("Saved");
            }}
          />
          <SettingsRow
            fs={fs}
            icon="heart-outline"
            label="Favorites"
            onPress={() => {
              // @ts-expect-error string-based navigation for mixed stack/tab routes
              (navigation as any).navigate("Favorites");
            }}
          />
          <SettingsRow
            fs={fs}
            icon="bar-chart-outline"
            label="Your Activity"
            onPress={() => {
              // @ts-expect-error string-based navigation for mixed stack/tab routes
              (navigation as any).navigate("Activity");
            }}
          />
          {/* Task 5 — Accessibility row shows current text size + temp unit */}
          <SettingsRow
            fs={fs}
            icon="settings-outline"
            label="Accessibility"
            value={accessibilitySubtitle}
            onPress={() => {
              // @ts-expect-error string-based navigation for mixed stack/tab routes
              (navigation as any).navigate("Accessibility");
            }}
            last
          />
        </View>

        {/* SUPPORT — Help, About, Logout */}
        <View style={styles.card}>
          <SettingsRow
            fs={fs}
            icon="help-circle-outline"
            label="Help"
            onPress={() => {
              // @ts-expect-error string-based navigation for mixed stack/tab routes
              (navigation as any).navigate("Help");
            }}
          />
          <SettingsRow
            fs={fs}
            icon="information-circle-outline"
            label="About"
            onPress={() => {
              // @ts-expect-error string-based navigation for mixed stack/tab routes
              (navigation as any).navigate("About");
            }}
          />
          <SettingsRow fs={fs} icon="log-out-outline" label="Log out" onPress={handleLogout} danger last />
        </View>

        {/* Version (tap 5× for dev section) */}
        <Pressable onPress={() => setVersionTaps((n) => n + 1)} style={styles.versionRow}>
          <Text style={[styles.versionText, { fontSize: fs(11) }]}>MYRA v{APP_VERSION}</Text>
        </Pressable>

        {showDevSection && __DEV__ && (
          <View style={styles.devCard}>
            <Text style={styles.devTitle}>Developer</Text>
            <Pressable onPress={() => setVersionTaps(0)} style={styles.devDismiss}>
              <Text style={styles.devDismissText}>Hide</Text>
            </Pressable>
          </View>
        )}

      </ScrollView>

      {/* Height picker modal */}
      <Modal visible={showHeightPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowHeightPicker(false)}>
        <View style={styles.pickerModal}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={() => setShowHeightPicker(false)}>
              <Text style={styles.pickerCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.pickerTitle}>Height</Text>
            <Pressable onPress={() => setShowHeightPicker(false)}>
              <Text style={styles.pickerDone}>Done</Text>
            </Pressable>
          </View>
          <Picker selectedValue={heightCm ?? 170} onValueChange={(v) => setHeightCm(v)} style={styles.picker}>
            {Array.from({ length: 71 }, (_, i) => i + 140).map((cm) => (
              <Picker.Item key={cm} label={formatHeight(cm)} value={cm} />
            ))}
          </Picker>
        </View>
      </Modal>

      {/* Weight picker modal */}
      <Modal visible={showWeightPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowWeightPicker(false)}>
        <View style={styles.pickerModal}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={() => setShowWeightPicker(false)}>
              <Text style={styles.pickerCancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.pickerTitle}>Weight</Text>
            <Pressable onPress={() => setShowWeightPicker(false)}>
              <Text style={styles.pickerDone}>Done</Text>
            </Pressable>
          </View>
          <Picker selectedValue={weightLb ?? 150} onValueChange={(v) => setWeightLb(v)} style={styles.picker}>
            {Array.from({ length: 261 }, (_, i) => i + 90).map((lb) => (
              <Picker.Item key={lb} label={formatWeight(lb)} value={lb} />
            ))}
          </Picker>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.background },
  scroll:    { paddingHorizontal: 20, paddingBottom: 48 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
    gap: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: P.cardSurface,
    justifyContent: 'center', alignItems: 'center',
  },
  pageTitle: {
    fontWeight: '700', color: P.primaryText, letterSpacing: -0.5,
  },

  /* Task 3 — profile card */
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.cardWhite,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: P.border,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 14,
    shadowColor: P.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
  },
  profileAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: `${P.accent}25`,
    justifyContent: 'center', alignItems: 'center',
  },
  profileAvatarText: {
    fontSize: 20, fontWeight: '700', color: P.accent,
  },
  profileInfo: { flex: 1 },
  profileName:  { fontWeight: '700', color: P.primaryText },
  profileEmail: { color: P.lightText, marginTop: 2 },

  sectionTitle: {
    fontWeight: '700', color: P.secondaryText,
    letterSpacing: 1.4, textTransform: 'uppercase',
    marginBottom: 8, marginTop: 4,
  },

  card: {
    backgroundColor: P.cardWhite,
    borderRadius: 18, borderWidth: 1, borderColor: P.border,
    marginBottom: 24, overflow: 'hidden',
    shadowColor: P.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1, shadowRadius: 12, elevation: 2,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16, gap: 12,
  },
  rowBorder:      { borderBottomWidth: 1, borderBottomColor: P.border },
  rowLast:        { height: 0 },
  rowIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: `${P.accent}15`,
    justifyContent: 'center', alignItems: 'center',
  },
  rowIconWrapDanger: { backgroundColor: `${P.danger}12` },
  rowBody:  { flex: 1 },
  rowLabel: { color: P.primaryText, fontWeight: '500' },
  rowValue: { color: P.secondaryText, marginTop: 2 },

  inlinePanel: {
    backgroundColor: `${P.accent}08`,
    borderTopWidth: 1, borderTopColor: P.border,
    borderBottomWidth: 1, borderBottomColor: P.border,
    padding: 16,
  },
  inlineLabel: {
    fontWeight: '700', color: P.secondaryText,
    letterSpacing: 0.6, textTransform: 'uppercase',
    marginTop: 12, marginBottom: 6,
  },
  inlineInput: {
    borderWidth: 1, borderColor: P.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    color: P.primaryText, backgroundColor: P.background,
  },
  inlinePickerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: P.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: P.background,
  },
  inlinePickerValue: { color: P.primaryText },
  inlineActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: P.border, alignItems: 'center',
  },
  cancelBtnText: { fontWeight: '600', color: P.primaryText },
  saveBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12,
    backgroundColor: P.accent, alignItems: 'center',
  },
  saveBtnText: { fontWeight: '700', color: '#FFFFFF' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: P.border,
    backgroundColor: P.background,
  },
  chipActive:     { backgroundColor: P.accent, borderColor: P.accent },
  chipText:       { fontSize: 13, color: P.secondaryText },
  chipTextActive: { color: '#FFFFFF', fontWeight: '600' },

  versionRow:  { alignItems: 'center', paddingVertical: 12 },
  versionText: { color: P.lightText, letterSpacing: 0.5 },

  devCard: {
    backgroundColor: '#1A1A2E', borderRadius: 14,
    padding: 16, marginBottom: 24,
  },
  devTitle:       { fontSize: 13, fontWeight: '700', color: '#8888CC', marginBottom: 8 },
  devDismiss:     { marginTop: 10, alignSelf: 'flex-end' },
  devDismissText: { fontSize: 12, color: '#6666AA' },

  pickerModal: { flex: 1, backgroundColor: P.background },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: P.border,
  },
  pickerCancel: { fontSize: 16, color: P.secondaryText },
  pickerTitle:  { fontSize: 17, fontWeight: '700', color: P.primaryText },
  pickerDone:   { fontSize: 16, fontWeight: '700', color: P.accent },
  picker:       { color: P.primaryText },

  prefRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  prefLabel:   { fontSize: 14, color: P.primaryText, fontWeight: '500' },
  prefSublabel:{ fontSize: 12, color: P.lightText, marginTop: 2 },
});
