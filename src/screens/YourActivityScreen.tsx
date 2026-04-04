import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../store/settings';
import { updateUserSettings } from '../api/user';
import { hapticFeedback } from '../utils/haptics';
import client from '../api/client';

// ─── Palette ──────────────────────────────────────────────────────────────────

const P = {
  background:    '#F5F0E8',
  cardSurface:   '#EDE6D8',
  cardWhite:     '#FFFFFF',
  primaryText:   '#3D3426',
  secondaryText: '#8C7E6A',
  lightText:     '#B5A894',
  accent:        '#C4A882',
  accentLight:   '#E8D9C5',
  border:        '#E8E0D0',
  shadow:        'rgba(61, 52, 38, 0.08)',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'year';

interface DailyBreakdown {
  date: string;
  totalScreenTime: number; // seconds
  sessionCount: number;
}

interface ActivityStats {
  period: Period;
  totalScreenTime: number;
  sessionCount: number;
  averageSessionDuration: number;
  dailyBreakdown: DailyBreakdown[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today',     label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week',      label: 'This Week' },
  { value: 'month',     label: 'This Month' },
  { value: 'year',      label: 'This Year' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatAxisLabel(dateStr: string, period: Period): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  if (period === 'year') {
    return d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  }
  if (period === 'month') {
    return String(d.getUTCDate());
  }
  return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function periodLabel(p: Period): string {
  return PERIODS.find((x) => x.value === p)?.label ?? p;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.headerRow}>
      <Pressable style={styles.backBtn} onPress={onBack} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color={P.primaryText} />
      </Pressable>
      <Text style={styles.pageTitle}>YOUR ACTIVITY</Text>
    </View>
  );
}

function PeriodDropdown({
  period, onSelect,
}: { period: Period; onSelect: (p: Period) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        style={styles.dropdownBtn}
        onPress={() => { hapticFeedback.light(); setOpen(true); }}
      >
        <Text style={styles.dropdownLabel}>Showing:</Text>
        <Text style={styles.dropdownValue}>{periodLabel(period)}</Text>
        <Ionicons name="chevron-down" size={16} color={P.secondaryText} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <View style={styles.dropdownSheet}>
            <Text style={styles.dropdownSheetTitle}>Select Period</Text>
            {PERIODS.map((item, idx) => (
              <Pressable
                key={item.value}
                style={[
                  styles.dropdownOption,
                  idx < PERIODS.length - 1 && styles.dropdownOptionBorder,
                ]}
                onPress={() => {
                  hapticFeedback.light();
                  onSelect(item.value);
                  setOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownOptionText,
                    period === item.value && styles.dropdownOptionTextActive,
                  ]}
                >
                  {item.label}
                </Text>
                {period === item.value && (
                  <Ionicons name="checkmark" size={17} color={P.accent} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function BarChart({ data, period }: { data: DailyBreakdown[]; period: Period }) {
  const maxSeconds = Math.max(...data.map((d) => d.totalScreenTime), 1);
  const MAX_BARS = period === 'year' ? 12 : period === 'month' ? 30 : 7;
  const visible = data.slice(-MAX_BARS);

  if (visible.length === 0) return null;

  return (
    <View style={styles.chartWrapper}>
      <View style={styles.chartBars}>
        {visible.map((item) => {
          const ratio = item.totalScreenTime / maxSeconds;
          const barHeight = Math.max(ratio * 120, item.totalScreenTime > 0 ? 4 : 2);
          return (
            <View key={item.date} style={styles.barColumn}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    { height: barHeight, backgroundColor: item.totalScreenTime > 0 ? P.accent : P.border },
                  ]}
                />
              </View>
              <Text style={styles.barLabel} numberOfLines={1}>
                {formatAxisLabel(item.date, period)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function DisableLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.disableLink} onPress={onPress}>
      <Text style={styles.disableLinkText}>Disable tracking</Text>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function YourActivityScreen() {
  const navigation = useNavigation();
  const settings = useSettings();
  const { screenTimeTrackingEnabled } = settings;

  const [period, setPeriod]   = useState<Period>('today');
  const [stats, setStats]     = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const fetchStats = useCallback(async (p: Period) => {
    setLoading(true);
    Animated.timing(fadeAnim, { toValue: 0.4, duration: 100, useNativeDriver: true }).start();
    try {
      const res = await client.get<ActivityStats>(`/api/activity/stats?period=${p}`);
      setStats(res.data);
    } catch (_) {
      // Silent — no retry button per spec
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    }
  }, [fadeAnim]);

  useEffect(() => {
    if (screenTimeTrackingEnabled) {
      void fetchStats(period);
    }
  }, [period, screenTimeTrackingEnabled, fetchStats]);

  const enableTracking = async () => {
    hapticFeedback.medium();
    settings.toggleScreenTimeTracking();
    try {
      await updateUserSettings({ screenTimeTrackingEnabled: true });
    } catch (_) {
      settings.toggleScreenTimeTracking(); // rollback
    }
  };

  const confirmDisable = () => {
    Alert.alert(
      'Stop tracking screen time?',
      'Your existing data will be kept but no new data will be recorded.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop Tracking',
          style: 'destructive',
          onPress: async () => {
            hapticFeedback.light();
            settings.toggleScreenTimeTracking();
            try {
              await updateUserSettings({ screenTimeTrackingEnabled: false });
            } catch (_) {
              settings.toggleScreenTimeTracking(); // rollback
            }
          },
        },
      ]
    );
  };

  const hasData = stats
    && (stats.totalScreenTime > 0 || stats.sessionCount > 0);

  // ── DISABLED ──────────────────────────────────────────────────────────────
  if (!screenTimeTrackingEnabled) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <Header onBack={() => navigation.goBack()} />
        <View style={styles.centeredFill}>
          <View style={styles.onboardCard}>
            <View style={styles.onboardIconWrap}>
              <Ionicons name="time-outline" size={36} color={P.accent} />
            </View>
            <Text style={styles.onboardTitle}>Start Tracking Your Activity</Text>
            <Text style={styles.onboardBody}>
              Monitor your screen time and app usage.{'\n'}Your data stays private.
            </Text>
            <Pressable style={styles.enableBtn} onPress={() => { void enableTracking(); }}>
              <Text style={styles.enableBtnText}>Enable Tracking</Text>
            </Pressable>
            <Text style={styles.privacyNote}>You can disable this anytime in Settings</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── ENABLED ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Header onBack={() => navigation.goBack()} />

        <PeriodDropdown period={period} onSelect={setPeriod} />

        <Animated.View style={{ opacity: fadeAnim }}>
          {loading && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={P.accent} />
            </View>
          )}

          {!loading && !hasData && (
            <View style={styles.noDataCard}>
              <Ionicons name="hourglass-outline" size={28} color={P.lightText} />
              <Text style={styles.noDataText}>
                Keep using MYRA to see your activity stats here
              </Text>
              <Text style={styles.noDataSub}>Tracking started just now</Text>
            </View>
          )}

          {!loading && hasData && stats && (
            <>
              {/* Main stats card */}
              <View style={styles.card}>
                <View style={styles.heroRow}>
                  <View style={styles.heroIconWrap}>
                    <Ionicons name="time-outline" size={22} color={P.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.heroTime}>
                      {formatDuration(stats.totalScreenTime)}
                    </Text>
                    <Text style={styles.heroPeriod}>{periodLabel(period)}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <StatRow label="Sessions"     value={String(stats.sessionCount)} />
                <StatRow label="Avg. session" value={formatDuration(stats.averageSessionDuration)} />
              </View>

              {/* Bar chart — week / month / year only */}
              {['week', 'month', 'year'].includes(period) && stats.dailyBreakdown.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.chartTitle}>Daily Breakdown</Text>
                  <BarChart data={stats.dailyBreakdown} period={period} />
                </View>
              )}
            </>
          )}
        </Animated.View>

        {/* Disable link — always visible when tracking is on */}
        {!loading && <DisableLink onPress={confirmDisable} />}
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

  // ── Disabled / onboard state ───────────────────────────────────────────────
  centeredFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  onboardCard: {
    backgroundColor: P.cardWhite,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: P.border,
    padding: 28,
    alignItems: 'center',
    width: '100%',
    shadowColor: P.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 3,
    gap: 12,
  },
  onboardIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: P.accentLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  onboardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: P.primaryText,
    textAlign: 'center',
  },
  onboardBody: {
    fontSize: 14,
    color: P.secondaryText,
    textAlign: 'center',
    lineHeight: 22,
  },
  enableBtn: {
    backgroundColor: P.accent,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 36,
    marginTop: 4,
  },
  enableBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  privacyNote: {
    fontSize: 12,
    color: P.lightText,
    textAlign: 'center',
  },

  // ── Period dropdown ────────────────────────────────────────────────────────
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: P.cardWhite,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: P.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    shadowColor: P.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 1,
  },
  dropdownLabel: {
    fontSize: 13,
    color: P.lightText,
    fontWeight: '500',
  },
  dropdownValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: P.primaryText,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(61, 52, 38, 0.35)',
    justifyContent: 'flex-end',
  },
  dropdownSheet: {
    backgroundColor: P.cardWhite,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 36,
    paddingHorizontal: 20,
  },
  dropdownSheetTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: P.lightText,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
    paddingVertical: 16,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
  },
  dropdownOptionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: P.border,
  },
  dropdownOptionText: {
    fontSize: 16,
    color: P.primaryText,
  },
  dropdownOptionTextActive: {
    fontWeight: '600',
    color: P.accent,
  },

  // ── Loading ────────────────────────────────────────────────────────────────
  loadingWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },

  // ── No data ────────────────────────────────────────────────────────────────
  noDataCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 40,
  },
  noDataText: {
    fontSize: 15,
    color: P.secondaryText,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  noDataSub: {
    fontSize: 12,
    color: P.lightText,
  },

  // ── Stats card ─────────────────────────────────────────────────────────────
  card: {
    backgroundColor: P.cardWhite,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: P.border,
    marginBottom: 16,
    padding: 20,
    shadowColor: P.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  heroIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: `${P.accent}18`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTime: {
    fontSize: 36,
    fontWeight: '700',
    color: P.primaryText,
    letterSpacing: -1,
  },
  heroPeriod: {
    fontSize: 13,
    color: P.secondaryText,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: P.border,
    marginBottom: 14,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  statLabel: { fontSize: 14, color: P.secondaryText },
  statValue: { fontSize: 14, fontWeight: '600', color: P.primaryText },

  // ── Chart ──────────────────────────────────────────────────────────────────
  chartTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: P.secondaryText,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  chartWrapper: { overflow: 'hidden' },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    minHeight: 150,
  },
  barColumn: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: {
    width: '100%',
    height: 130,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: { width: '80%', borderRadius: 4, minHeight: 2 },
  barLabel: { fontSize: 9, color: P.lightText, textAlign: 'center' },

  // ── Disable link ───────────────────────────────────────────────────────────
  disableLink: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginTop: 8,
  },
  disableLinkText: {
    fontSize: 13,
    color: P.lightText,
    textDecorationLine: 'underline',
  },
});
