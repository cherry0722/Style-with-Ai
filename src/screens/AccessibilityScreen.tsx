/**
 * Accessibility Screen — text size (Small / Medium / Large) and temperature unit.
 * Both settings are persisted in the Zustand settings store.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSettings } from '../store/settings';
import { updateUserSettings } from '../api/user';
import { hapticFeedback } from '../utils/haptics';

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

type TextSizeOption = 'small' | 'medium' | 'large';

const TEXT_SIZES: { key: TextSizeOption; label: string; previewSize: number }[] = [
  { key: 'small',  label: 'Small',  previewSize: 12 },
  { key: 'medium', label: 'Medium', previewSize: 15 },
  { key: 'large',  label: 'Large',  previewSize: 19 },
];

export default function AccessibilityScreen() {
  const navigation = useNavigation();
  const settings   = useSettings();

  const currentSize = settings.textSize ?? 'medium';
  const isFahrenheit = settings.temperatureUnit === 'fahrenheit';

  const handleTextSize = (size: TextSizeOption) => {
    hapticFeedback.light();
    settings.setTextSize(size);
  };

  const handleTempToggle = async () => {
    const newUnit = isFahrenheit ? 'celsius' : 'fahrenheit';
    hapticFeedback.light();
    settings.toggleTemperatureUnit();
    try {
      await updateUserSettings({ temperatureUnit: newUnit });
    } catch {
      settings.toggleTemperatureUnit(); // revert on error
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={P.primaryText} />
        </Pressable>
        <Text style={styles.pageTitle}>ACCESSIBILITY</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Text Size */}
        <Text style={styles.sectionTitle}>Text Size</Text>
        <View style={styles.card}>
          <View style={styles.chipRow}>
            {TEXT_SIZES.map((opt) => {
              const active = currentSize === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => handleTextSize(opt.key)}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive, { fontSize: opt.previewSize }]}>
                    Aa
                  </Text>
                  <Text style={[styles.chipSub, active && styles.chipSubActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.previewBox}>
            <Text style={[styles.previewText, { fontSize: TEXT_SIZES.find(t => t.key === currentSize)!.previewSize + 1 }]}>
              Preview: "Your outfit for today is ready."
            </Text>
          </View>
        </View>

        {/* Temperature Unit */}
        <Text style={styles.sectionTitle}>Temperature Unit</Text>
        <View style={styles.card}>
          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <Ionicons name="thermometer-outline" size={18} color={P.accent} style={styles.prefIcon} />
              <View>
                <Text style={styles.prefLabel}>
                  {isFahrenheit ? 'Fahrenheit (°F)' : 'Celsius (°C)'}
                </Text>
                <Text style={styles.prefSub}>Used on Home and weather cards</Text>
              </View>
            </View>
            <Switch
              value={isFahrenheit}
              onValueChange={handleTempToggle}
              trackColor={{ false: P.border, true: `${P.accent}55` }}
              thumbColor={isFahrenheit ? P.accent : P.lightText}
            />
          </View>
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
  scroll:    { paddingHorizontal: 20, paddingBottom: 48 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#8C7E6A',
    letterSpacing: 1.4, textTransform: 'uppercase',
    marginBottom: 8, marginTop: 4,
  },
  card: {
    backgroundColor: P.cardWhite, borderRadius: 18,
    borderWidth: 1, borderColor: P.border, marginBottom: 24,
    overflow: 'hidden',
    shadowColor: 'rgba(61,52,38,0.08)',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 2,
  },
  chipRow: {
    flexDirection: 'row', gap: 0,
    borderBottomWidth: 1, borderBottomColor: P.border,
  },
  chip: {
    flex: 1, alignItems: 'center', paddingVertical: 16,
    borderRightWidth: 1, borderRightColor: P.border,
  },
  chipActive: { backgroundColor: `${P.accent}15` },
  chipLabel: { color: P.secondaryText, fontWeight: '700' },
  chipLabelActive: { color: P.accent },
  chipSub: { fontSize: 11, color: P.lightText, marginTop: 4 },
  chipSubActive: { color: P.accent, fontWeight: '600' },
  previewBox: { padding: 16 },
  previewText: { color: P.primaryText, lineHeight: 22 },
  prefRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  prefLeft:  { flexDirection: 'row', alignItems: 'center', flex: 1 },
  prefIcon:  { marginRight: 12 },
  prefLabel: { fontSize: 15, color: P.primaryText, fontWeight: '500' },
  prefSub:   { fontSize: 12, color: P.lightText, marginTop: 2 },
});
