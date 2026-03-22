/**
 * About Screen — full project description, how MYRA works, features, privacy, terms.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

const APP_VERSION = '1.0.0';

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.infoTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.infoText}>{children}</Text>;
}

const HOW_IT_WORKS = [
  {
    icon: 'camera-outline' as const,
    step: '1. Capture Your Wardrobe',
    desc: 'Photograph each clothing item using your camera or select from your photo library. MYRA stores every piece in your personal digital closet.',
  },
  {
    icon: 'sparkles-outline' as const,
    step: '2. AI Analysis',
    desc: 'Our AI automatically identifies the category, type, fabric, colour, pattern, fit, and style tags for each item — no manual entry needed.',
  },
  {
    icon: 'partly-sunny-outline' as const,
    step: '3. Weather-Smart Suggestions',
    desc: 'MYRA pulls real-time local weather for your area and cross-references it with your wardrobe to recommend outfits that are both stylish and appropriate for the day.',
  },
  {
    icon: 'body-outline' as const,
    step: '4. Personalised to You',
    desc: 'Set your body type, pronouns, and style preferences during onboarding. MYRA uses this profile to tailor every suggestion specifically to you.',
  },
  {
    icon: 'calendar-outline' as const,
    step: '5. Plan Ahead',
    desc: 'Use the Calendar to schedule outfits for upcoming events — interviews, parties, dates, or a casual day out. Never scramble for what to wear again.',
  },
  {
    icon: 'water-outline' as const,
    step: '6. Laundry Tracker',
    desc: 'Mark items as "in the wash" in the Laundry section and MYRA will automatically exclude them from suggestions until they are back in your closet.',
  },
];

const FEATURES = [
  { icon: 'shirt-outline'          as const, label: 'Digital Wardrobe',       desc: 'Your entire closet, organised and searchable.' },
  { icon: 'sunny-outline'          as const, label: 'Weather Integration',      desc: '7-day forecast with daily outfit tips.' },
  { icon: 'person-circle-outline'  as const, label: 'Avatar',                  desc: 'A visual avatar wearing your outfit of the day.' },
  { icon: 'search-outline'         as const, label: 'Smart Filtering',          desc: 'Filter by category, colour, favourites and more.' },
  { icon: 'heart-outline'          as const, label: 'Favourites',               desc: 'Star the items you love most for quick access.' },
  { icon: 'notifications-outline'  as const, label: 'Daily Reminders',          desc: 'Morning outfit notifications so you start the day ready.' },
];

export default function AboutScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={P.primaryText} />
        </Pressable>
        <Text style={styles.pageTitle}>ABOUT</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Identity card */}
        <View style={styles.identityCard}>
          <View style={styles.logoWrap}>
            <Ionicons name="shirt-outline" size={38} color={P.accent} />
          </View>
          <Text style={styles.appName}>MYRA</Text>
          <Text style={styles.appTagline}>Your AI-Powered Personal Stylist</Text>
          <Text style={styles.appVersion}>Version {APP_VERSION}</Text>
        </View>

        {/* What is MYRA */}
        <SectionTitle title="What is MYRA?" />
        <View style={styles.card}>
          <InfoBlock title="Meet MYRA">
            <InfoText>
              MYRA (My Responsive Attire Assistant) is an AI-powered wardrobe management app built to make getting dressed effortless. Whether you have a closet full of clothes and nothing to wear, or you simply want smarter outfit choices every morning, MYRA has you covered.
            </InfoText>
          </InfoBlock>
          <View style={styles.divider} />
          <InfoBlock title="The Problem We Solve">
            <InfoText>
              Most people own plenty of clothes but repeatedly reach for the same few pieces — leaving the rest forgotten. MYRA digitises your entire wardrobe, surfaces forgotten items, and combines them into outfits you actually want to wear, matched to the weather and your personal style.
            </InfoText>
          </InfoBlock>
          <View style={styles.divider} />
          <InfoBlock title="Built for Everyone">
            <InfoText>
              MYRA supports all body types, pronouns, and style preferences. It adapts to you — not the other way around. From minimalist to bold, casual to formal, MYRA understands your wardrobe and your taste.
            </InfoText>
          </InfoBlock>
        </View>

        {/* How it works */}
        <SectionTitle title="How MYRA Works" />
        <View style={styles.card}>
          {HOW_IT_WORKS.map((item, idx) => (
            <React.Fragment key={item.step}>
              <View style={styles.stepRow}>
                <View style={styles.stepIconWrap}>
                  <Ionicons name={item.icon} size={18} color={P.accent} />
                </View>
                <View style={styles.stepBody}>
                  <Text style={styles.stepLabel}>{item.step}</Text>
                  <Text style={styles.stepDesc}>{item.desc}</Text>
                </View>
              </View>
              {idx < HOW_IT_WORKS.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Key features */}
        <SectionTitle title="Key Features" />
        <View style={styles.card}>
          {FEATURES.map((f, idx) => (
            <React.Fragment key={f.label}>
              <View style={styles.featureRow}>
                <View style={styles.stepIconWrap}>
                  <Ionicons name={f.icon} size={18} color={P.accent} />
                </View>
                <View style={styles.stepBody}>
                  <Text style={styles.featureLabel}>{f.label}</Text>
                  <Text style={styles.stepDesc}>{f.desc}</Text>
                </View>
              </View>
              {idx < FEATURES.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Privacy & Terms */}
        <SectionTitle title="Legal" />
        <View style={styles.card}>
          <InfoBlock title="Privacy Policy">
            <InfoText>
              MYRA is designed with your privacy in mind. We collect only what is necessary to deliver the service: your wardrobe photos, outfit preferences, body profile, and location (only when you grant permission).{'\n\n'}
              Your photos are stored securely on our servers and are never sold or shared with third parties. Location data is used solely to fetch local weather and is not stored beyond the session. You can delete your account and all associated data at any time by contacting our support team at contactMYRAteam@gmail.com.{'\n\n'}
              We do not use your data for advertising. We do not build profiles for third parties. What's in your closet stays between you and MYRA.
            </InfoText>
          </InfoBlock>
          <View style={styles.divider} />
          <InfoBlock title="Terms of Service">
            <InfoText>
              By using MYRA, you agree to the following:{'\n\n'}
              • The app is intended for personal, non-commercial use only.{'\n'}
              • You are responsible for the photos and content you upload. Do not upload content that infringes copyright or contains inappropriate material.{'\n'}
              • MYRA is provided "as is" without warranties of any kind. We strive for accuracy in AI analysis but cannot guarantee perfect results at all times.{'\n'}
              • We reserve the right to update these terms with reasonable notice. Continued use of the app constitutes acceptance of any changes.{'\n\n'}
              For questions or concerns, contact us at contactMYRAteam@gmail.com.
            </InfoText>
          </InfoBlock>
        </View>

        <Text style={styles.footer}>© 2026 MYRA. All rights reserved.{'\n'}Made with care for style-conscious humans everywhere.</Text>

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
  identityCard: {
    backgroundColor: P.cardWhite, borderRadius: 18,
    borderWidth: 1, borderColor: P.border,
    alignItems: 'center', paddingVertical: 32, marginBottom: 24,
    shadowColor: 'rgba(61,52,38,0.08)',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2,
  },
  logoWrap: {
    width: 76, height: 76, borderRadius: 22,
    backgroundColor: `${P.accent}18`,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  appName:    { fontSize: 30, fontWeight: '800', color: P.primaryText, letterSpacing: -0.5 },
  appTagline: { fontSize: 13, color: P.secondaryText, marginTop: 5, textAlign: 'center', paddingHorizontal: 32 },
  appVersion: { fontSize: 12, color: P.lightText, marginTop: 10 },
  card: {
    backgroundColor: P.cardWhite, borderRadius: 18,
    borderWidth: 1, borderColor: P.border, marginBottom: 24, overflow: 'hidden',
    shadowColor: 'rgba(61,52,38,0.08)',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2,
  },
  divider: { height: 1, backgroundColor: P.border, marginHorizontal: 16 },
  infoBlock: { paddingHorizontal: 16, paddingVertical: 14 },
  infoTitle: { fontSize: 14, fontWeight: '700', color: P.primaryText, marginBottom: 7 },
  infoText:  { fontSize: 13, color: P.secondaryText, lineHeight: 21 },
  stepRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  featureRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  stepIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: `${P.accent}15`,
    justifyContent: 'center', alignItems: 'center', marginTop: 1,
  },
  stepBody:    { flex: 1 },
  stepLabel:   { fontSize: 13, fontWeight: '700', color: P.primaryText, marginBottom: 4 },
  featureLabel:{ fontSize: 14, fontWeight: '600', color: P.primaryText, marginBottom: 2 },
  stepDesc:    { fontSize: 13, color: P.secondaryText, lineHeight: 19 },
  footer: {
    fontSize: 12, color: P.lightText, textAlign: 'center',
    marginTop: 8, marginBottom: 8, lineHeight: 18,
  },
});
