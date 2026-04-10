import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

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
} as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function InfoRow({
  icon, label, value, last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.rowBorder]}>
      <View style={styles.rowIconWrap}>
        <Ionicons name={icon} size={18} color={P.accent} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function LegalRow({
  icon, label, description, onPress, last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <View style={styles.rowIconWrap}>
        <Ionicons name={icon} size={18} color={P.accent} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={P.lightText} />
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AboutScreen() {
  const navigation = useNavigation();
  const iosVersion = Platform.Version;

  const showPrivacyPolicy = () => {
    Alert.alert(
      'Privacy Policy',
      'Your privacy is important to us. Your data is stored securely and never shared with third parties. All data processing happens on your device and our secure servers.',
      [{ text: 'OK' }]
    );
  };

  const showTerms = () => {
    Alert.alert(
      'Terms of Service',
      'By using MYRA, you agree to our terms. We provide the service as-is and reserve the right to update features and policies.',
      [{ text: 'OK' }]
    );
  };

  const showDataUsage = () => {
    Alert.alert(
      'Data Usage',
      'We collect:\n• Closet items you add\n• Outfit preferences\n• Calendar events\n• Screen time (if enabled)\n\nAll data is encrypted and only accessible by you.',
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={P.primaryText} />
          </Pressable>
          <Text style={styles.pageTitle}>ABOUT</Text>
        </View>

        {/* Logo & Tagline */}
        <View style={[styles.card, styles.logoCard]}>
          <View style={styles.logoIconWrap}>
            <Ionicons name="shirt-outline" size={60} color={P.accent} />
          </View>
          <Text style={styles.appName}>MYRA</Text>
          <Text style={styles.tagline}>Your AI-Powered Personal Stylist</Text>
        </View>

        {/* App Information */}
        <SectionHeader title="App Information" />
        <View style={styles.card}>
          <InfoRow icon="code-outline"           label="Version"  value="1.0.0" />
          <InfoRow icon="construct-outline"      label="Build"    value="2026.04.02" />
          <InfoRow icon="phone-portrait-outline" label="Platform" value={`iOS ${iosVersion}`} last />
        </View>

        {/* Legal & Privacy */}
        <SectionHeader title="Legal & Privacy" />
        <View style={styles.card}>
          <LegalRow
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            description="How we protect your data"
            onPress={showPrivacyPolicy}
          />
          <LegalRow
            icon="document-text-outline"
            label="Terms of Service"
            description="Agreement and guidelines"
            onPress={showTerms}
          />
          <LegalRow
            icon="analytics-outline"
            label="Data Usage Policy"
            description="What data we collect"
            onPress={showDataUsage}
            last
          />
        </View>

        {/* Credits */}
        <SectionHeader title="Credits" />
        <View style={[styles.card, styles.creditsCard]}>
          <Text style={styles.creditsMain}> MYRA Team</Text>
          <Text style={styles.creditsSub}>Powered by AI technology</Text>
          
        </View>

        {/* Footer */}
        <Text style={styles.footer}>© 2026 MYRA. All rights reserved.</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.background },
  scroll:    { paddingHorizontal: 20, paddingBottom: 48 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 20,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: P.cardSurface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: P.primaryText,
    letterSpacing: -0.5,
  },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: P.secondaryText,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },

  card: {
    backgroundColor: P.cardWhite,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: P.border,
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: P.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
  },

  // Logo card
  logoCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 24,
  },
  logoIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: `${P.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: P.primaryText,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: 14,
    color: P.secondaryText,
    textAlign: 'center',
  },

  // Info rows (non-clickable)
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: P.border },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: `${P.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLabel: { flex: 1, fontSize: 15, color: P.primaryText, fontWeight: '500' },
  rowValue: { fontSize: 14, color: P.secondaryText },

  // Legal rows (clickable)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowBody:        { flex: 1 },
  rowDescription: { fontSize: 12, color: P.secondaryText, marginTop: 2 },

  // Credits card
  creditsCard: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 8,
  },
  creditsMain: { fontSize: 14, color: P.secondaryText, textAlign: 'center' },
  creditsSub:  { fontSize: 12, color: P.lightText,     textAlign: 'center' },

  // Footer
  footer: {
    fontSize: 11,
    color: P.lightText,
    textAlign: 'center',
    paddingBottom: 48,
    letterSpacing: 0.3,
  },
});
