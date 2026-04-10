import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';

// ─── Palette ──────────────────────────────────────────────────────────────────

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

const SUPPORT_EMAIL = 'ContactMyra@gmail.com';
const APP_VERSION   = '1.0.0';

// ─── FAQ data ─────────────────────────────────────────────────────────────────

const FAQS: { q: string; a: string }[] = [
  {
    q: 'How do I add clothes to my closet?',
    a: 'Tap the + button at the bottom of the Closet tab. You can either take a photo with your camera or choose from your photo library. Add details like item name, category, and color to help organize your wardrobe.',
  },
  {
    q: 'How does outfit planning work?',
    a: 'Go to the Plan tab and select a date on your calendar. MYRA will suggest outfits based on the weather, occasion, and clothes in your closet. You can save outfits for specific events.',
  },
  {
    q: 'Can I edit calendar events?',
    a: 'Yes! Tap on any event in your calendar to view details. You can edit the outfit, change the occasion, or delete the event entirely.',
  },
  {
    q: 'How do I track laundry?',
    a: "In your Closet, tap and hold any item to mark it as 'In Laundry'. These items will appear in your Laundry view and won't be suggested for outfits until you mark them as clean.",
  },
  {
    q: 'What is screen time tracking?',
    a: 'Screen time tracking shows how much time you spend in MYRA. Enable it in Settings → Accessibility. Your data is private and stored only on your device and personal account.',
  },
  {
    q: 'How do I delete my account?',
    a: 'Go to Settings → Account Privacy → Delete Account. This action is permanent and will remove all your data including closet items, outfits, and calendar events.',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function ContactRow({
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

function FaqItem({
  item, expanded, onPress, last,
}: {
  item: { q: string; a: string };
  expanded: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.faqItem, !last && styles.faqBorder, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <View style={styles.faqHeader}>
        <Text style={styles.faqQuestion}>{item.q}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={P.lightText}
        />
      </View>
      {expanded && (
        <Text style={styles.faqAnswer}>{item.a}</Text>
      )}
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HelpScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const openEmail = async (subject: string, body: string) => {
    try {
      const userId = user?.id ?? 'unknown';
      const resolvedBody = body
        .replace('[Platform.Version]', String(Platform.Version))
        .replace('[User ID]', userId);

      const encodedSubject = encodeURIComponent(subject);
      const encodedBody    = encodeURIComponent(resolvedBody);
      const url = `mailto:${SUPPORT_EMAIL}?subject=${encodedSubject}&body=${encodedBody}`;

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        // No mail client available — show the address so the user can reach out manually
        Alert.alert(
          'No Mail App Found',
          `Please email us directly at:\n\n${SUPPORT_EMAIL}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('[Help] Failed to open email:', error);
      Alert.alert(
        'Could Not Open Mail',
        `Please email us directly at:\n\n${SUPPORT_EMAIL}`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleContactSupport = () => {
    void openEmail(
      'MYRA Support Request',
      `App Version: ${APP_VERSION}\niOS Version: [Platform.Version]\nUser ID: [User ID]\n\nDescribe your issue:\n`
    );
  };

  const handleReportBug = () => {
    void openEmail(
      'Bug Report - MYRA',
      `App Version: ${APP_VERSION}\niOS Version: [Platform.Version]\n\nWhat happened?\n\n\nWhen did it happen?\n\n\nSteps to reproduce:\n1. \n2. \n3. `
    );
  };

  const handleSendFeedback = () => {
    void openEmail('Feedback for MYRA', '');
  };

  const toggleFaq = (idx: number) => {
    setExpandedFaq((prev) => (prev === idx ? null : idx));
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={P.primaryText} />
          </Pressable>
          <Text style={styles.pageTitle}>HELP</Text>
        </View>

        {/* Get in Touch */}
        <SectionHeader title="Get in Touch" />
        <View style={styles.card}>
          <ContactRow
            icon="mail-outline"
            label="Contact Support"
            description="Get help with any issues"
            onPress={handleContactSupport}
          />
          <ContactRow
            icon="bug-outline"
            label="Report a Bug"
            description="Found something broken?"
            onPress={handleReportBug}
          />
          <ContactRow
            icon="chatbubble-outline"
            label="Send Feedback"
            description="Share ideas or suggestions"
            onPress={handleSendFeedback}
            last
          />
        </View>

        {/* FAQ */}
        <SectionHeader title="Frequently Asked Questions" />
        <View style={styles.card}>
          {FAQS.map((item, idx) => (
            <FaqItem
              key={idx}
              item={item}
              expanded={expandedFaq === idx}
              onPress={() => toggleFaq(idx)}
              last={idx === FAQS.length - 1}
            />
          ))}
        </View>

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

  // Contact rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowBorder:    { borderBottomWidth: 1, borderBottomColor: P.border },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: `${P.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowBody:        { flex: 1 },
  rowLabel:       { fontSize: 15, color: P.primaryText, fontWeight: '500' },
  rowDescription: { fontSize: 12, color: P.secondaryText, marginTop: 2 },

  // FAQ accordion
  faqItem:   { paddingVertical: 16, paddingHorizontal: 16 },
  faqBorder: { borderBottomWidth: 1, borderBottomColor: P.border },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: P.primaryText,
  },
  faqAnswer: {
    fontSize: 14,
    color: P.secondaryText,
    lineHeight: 20,
    marginTop: 10,
  },
});
