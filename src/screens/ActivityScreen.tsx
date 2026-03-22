/**
 * Activity Screen — shows total time the user has spent in the app.
 * Time is tracked via AppState changes and persisted in the settings store.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSettings } from '../store/settings';

const P = {
  background:    '#F5F0E8',
  cardWhite:     '#FFFFFF',
  cardSurface:   '#EDE6D8',
  primaryText:   '#3D3426',
  secondaryText: '#8C7E6A',
  lightText:     '#B5A894',
  accent:        '#C4A882',
  border:        '#E8E0D0',
} as const;

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours   = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export default function ActivityScreen() {
  const navigation  = useNavigation();
  const { totalTimeSpentMs } = useSettings();

  const displayed = (totalTimeSpentMs ?? 0);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={P.primaryText} />
        </Pressable>
        <Text style={styles.pageTitle}>YOUR ACTIVITY</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="time-outline" size={32} color={P.accent} />
          </View>
          <Text style={styles.label}>Total time in app</Text>
          <Text style={styles.value}>{formatDuration(displayed)}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: P.cardSurface,
    justifyContent: 'center', alignItems: 'center',
  },
  pageTitle: {
    fontSize: 30, fontWeight: '700',
    color: P.primaryText, letterSpacing: -0.5,
  },
  content: {
    flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32,
  },
  card: {
    backgroundColor: P.cardWhite,
    borderRadius: 20, borderWidth: 1, borderColor: P.border,
    paddingVertical: 40, paddingHorizontal: 48,
    alignItems: 'center',
    shadowColor: 'rgba(61,52,38,0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1, shadowRadius: 12, elevation: 2,
    width: '100%',
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: `#C4A88215`,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  label: {
    fontSize: 13, color: P.secondaryText,
    fontWeight: '600', letterSpacing: 0.4,
    textTransform: 'uppercase', marginBottom: 10,
  },
  value: {
    fontSize: 42, fontWeight: '700',
    color: P.primaryText, letterSpacing: -1,
  },
});
