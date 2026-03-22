/**
 * Help Screen — FAQ, contact support, report a bug, troubleshooting tips.
 */
import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const P = {
  background:    '#F5F0E8',
  cardSurface:   '#EDE6D8',
  cardWhite:     '#FFFFFF',
  primaryText:   '#3D3426',
  secondaryText: '#8C7E6A',
  lightText:     '#B5A894',
  accent:        '#C4A882',
  border:        '#E8E0D0',
} as const;

const SUPPORT_EMAIL = 'contactMYRAteam@gmail.com';

const FAQ_ITEMS = [
  {
    q: 'How do I create an account?',
    a: 'On the Welcome screen tap "Sign Up", enter your email, choose a username and password, then complete the onboarding profile (body type, pronouns, style preferences). Your account is ready immediately.',
  },
  {
    q: 'How do I add clothes to my wardrobe?',
    a: 'Tap the "+" button in the centre of the bottom navigation bar. Choose "Take photo" to photograph an item with your camera, or "Choose from library" to import an existing photo. MYRA\'s AI will automatically analyse and categorise it for you.',
  },
  {
    q: 'What does the Home screen show?',
    a: 'The Home screen shows your avatar dressed in today\'s AI-generated outfit suggestion, the current weather for your location (temperature, condition, 7-day forecast), and a daily outfit tip tailored to the conditions.',
  },
  {
    q: 'How does weather-based styling work?',
    a: 'With Location permission enabled, MYRA fetches real-time weather for your area. It then matches items in your wardrobe to the temperature and conditions — lightweight layers on mild days, warm outerwear when it\'s cold, and so on.',
  },
  {
    q: 'What is the Laundry section?',
    a: 'The Laundry screen lets you mark items that are currently in the wash. MYRA will not suggest those items until you mark them as clean and return them to your closet.',
  },
  {
    q: 'How do I plan an outfit for a future event?',
    a: 'Go to the Calendar tab, tap a date and add an event (e.g. interview, party, date night). MYRA will generate outfit suggestions appropriate for that occasion on that day.',
  },
  {
    q: 'Can I favourite specific clothing items?',
    a: 'Yes — tap the heart icon on any item in your closet to mark it as a favourite. You can then filter your wardrobe to show only favourites, and MYRA will prioritise them in suggestions.',
  },
  {
    q: 'How do I change the temperature unit?',
    a: 'Go to Settings → Accessibility and toggle between Celsius and Fahrenheit. The change applies immediately across the Home screen and all weather cards.',
  },
  {
    q: 'Why is my location / camera / photo library not working?',
    a: 'Go to Settings → Information & Permissions and make sure the relevant toggle is enabled. If it still does not work, go to your device\'s system Settings, find MYRA, and verify the permission is allowed there too.',
  },
  {
    q: 'How do I delete a clothing item?',
    a: 'Open your Closet, long-press or tap the item to open its detail view, then tap the delete option. The item is permanently removed from your wardrobe and will no longer appear in suggestions.',
  },
];

const TROUBLESHOOTING = [
  {
    icon: 'wifi-outline'           as const,
    title: 'No internet connection',
    tip:  'MYRA needs an internet connection to load weather data and sync your wardrobe. Check your Wi-Fi or mobile data and try again.',
  },
  {
    icon: 'lock-open-outline'      as const,
    title: 'Permission issues',
    tip:  'If camera, photo library, or location features are not working, go to Settings → Information & Permissions and enable the relevant toggle. You may also need to allow it in your device\'s system Settings.',
  },
  {
    icon: 'cloud-offline-outline'  as const,
    title: 'Outfit or weather not loading',
    tip:  'Pull down on the Home screen to refresh. If the problem persists, check your internet connection and ensure Location permission is granted.',
  },
  {
    icon: 'image-outline'          as const,
    title: 'Photo upload failing',
    tip:  'Make sure Photo Library and Camera permissions are enabled. If a photo fails to upload, try a smaller image or check your internet connection.',
  },
  {
    icon: 'refresh-outline'        as const,
    title: 'App feels stuck or slow',
    tip:  'Close the app fully and reopen it. If the issue continues, try logging out from Settings and logging back in.',
  },
  {
    icon: 'person-outline'         as const,
    title: 'Avatar not reflecting my outfit',
    tip:  'The avatar updates once an outfit suggestion has been generated for today. Return to the Home screen after adding items to your wardrobe and wait a moment for the suggestion to load.',
  },
];

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((v) => !v)} style={styles.faqItem}>
      <View style={styles.faqHeader}>
        <Text style={styles.faqQ}>{q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={P.lightText} />
      </View>
      {open && <Text style={styles.faqA}>{a}</Text>}
    </Pressable>
  );
}

export default function HelpScreen() {
  const navigation = useNavigation();

  const openEmail = (subject: string) => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={P.primaryText} />
        </Pressable>
        <Text style={styles.pageTitle}>HELP</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* FAQ */}
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        <View style={styles.card}>
          {FAQ_ITEMS.map((item, idx) => (
            <React.Fragment key={item.q}>
              <FAQItem q={item.q} a={item.a} />
              {idx < FAQ_ITEMS.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Contact & Bug Report */}
        <Text style={styles.sectionTitle}>Support</Text>
        <View style={styles.card}>
          <Pressable style={styles.actionRow} onPress={() => openEmail('Support Request')}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="mail-outline" size={18} color={P.accent} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Contact Support</Text>
              <Text style={styles.rowSub}>{SUPPORT_EMAIL}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={P.lightText} />
          </Pressable>

          <View style={styles.divider} />

          <Pressable style={styles.actionRow} onPress={() => openEmail('Bug Report — MYRA')}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="bug-outline" size={18} color={P.accent} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Report a Bug</Text>
              <Text style={styles.rowSub}>Raise a ticket — we'll get back to you shortly</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={P.lightText} />
          </Pressable>
        </View>

        {/* Troubleshooting */}
        <Text style={styles.sectionTitle}>Troubleshooting</Text>
        <View style={styles.card}>
          {TROUBLESHOOTING.map((item, idx) => (
            <React.Fragment key={item.title}>
              <View style={styles.tipRow}>
                <View style={styles.tipIconWrap}>
                  <Ionicons name={item.icon} size={18} color={P.accent} />
                </View>
                <View style={styles.tipBody}>
                  <Text style={styles.tipTitle}>{item.title}</Text>
                  <Text style={styles.tipText}>{item.tip}</Text>
                </View>
              </View>
              {idx < TROUBLESHOOTING.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.background },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: P.cardSurface,
    justifyContent: 'center', alignItems: 'center',
  },
  pageTitle: { fontSize: 30, fontWeight: '700', color: P.primaryText, letterSpacing: -0.5 },
  scroll: { paddingHorizontal: 20, paddingBottom: 48 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: P.secondaryText,
    letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8, marginTop: 4,
  },
  card: {
    backgroundColor: P.cardWhite, borderRadius: 18,
    borderWidth: 1, borderColor: P.border, marginBottom: 24, overflow: 'hidden',
    shadowColor: 'rgba(61,52,38,0.08)',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2,
  },
  divider: { height: 1, backgroundColor: P.border, marginHorizontal: 16 },

  faqItem:   { paddingHorizontal: 16, paddingVertical: 14 },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faqQ:      { fontSize: 14, fontWeight: '600', color: P.primaryText, flex: 1, marginRight: 8 },
  faqA:      { fontSize: 13, color: P.secondaryText, marginTop: 8, lineHeight: 20 },

  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  rowIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: `${P.accent}15`,
    justifyContent: 'center', alignItems: 'center',
  },
  rowBody:  { flex: 1 },
  rowLabel: { fontSize: 15, color: P.primaryText, fontWeight: '500' },
  rowSub:   { fontSize: 12, color: P.lightText, marginTop: 2 },

  tipRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  tipIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: `${P.accent}15`,
    justifyContent: 'center', alignItems: 'center', marginTop: 1,
  },
  tipBody:  { flex: 1 },
  tipTitle: { fontSize: 14, fontWeight: '600', color: P.primaryText, marginBottom: 3 },
  tipText:  { fontSize: 13, color: P.secondaryText, lineHeight: 19 },
});
