/**
 * Home tab — Daily Hub: GET /api/home/today, weather (optional lat/lon), today's plans.
 * Uses API_BASE_URL only. Pull-to-refresh + retry. No Python AI.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { fetchHomeToday, HomeTodayResponse } from '../api/home';

function formatTodayLabel(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return 'Today';
  const d = new Date(dateStr + 'T12:00:00Z');
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  return d.toLocaleDateString(undefined, options);
}

export default function HomeScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { user, token } = useAuth();
  const [data, setData] = useState<HomeTodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lon: number } | null>(null);

  const loadLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationCoords(null);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      if (loc?.coords) {
        setLocationCoords({ lat: loc.coords.latitude, lon: loc.coords.longitude });
      } else {
        setLocationCoords(null);
      }
    } catch (_) {
      setLocationCoords(null);
    }
  }, []);

  const loadHomeToday = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }
    try {
      setError(null);
      const params = locationCoords ? { lat: locationCoords.lat, lon: locationCoords.lon } : undefined;
      const result = await fetchHomeToday(params);
      setData(result);
    } catch (err: any) {
      const msg = err?.message ?? 'Failed to load today';
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, locationCoords]);

  useEffect(() => {
    loadLocation();
  }, [loadLocation]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    loadHomeToday();
  }, [token, locationCoords]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadHomeToday();
  }, [loadHomeToday]);

  const goToCalendar = useCallback(() => {
    (navigation as any).navigate('Calendar');
  }, [navigation]);

  const styles = createStyles(theme);

  if (!user) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { flex: 1 }]}>
        <View style={styles.center}>
          <Text style={styles.title}>Sign in to see your day</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !data) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { flex: 1 }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const dateLabel = data?.date ? formatTodayLabel(data.date) : 'Today';
  const weather = data?.weather;
  const plans = data?.plans ?? [];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.accent]} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.dateTitle}>Today • {dateLabel}</Text>
      </View>

      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => { setLoading(true); loadHomeToday(); }}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.weatherCard}>
        {weather?.ok ? (
          <>
            <Text style={styles.weatherMain}>
              {weather.tempF != null ? Math.round(weather.tempF) : '—'}°F
              {weather.condition ? ` • ${weather.condition}` : ''}
            </Text>
            {weather.cached && <Text style={styles.weatherMeta}>Cached</Text>}
          </>
        ) : (
          <>
            <Text style={styles.weatherMessage}>{weather?.message ?? 'Weather unavailable'}</Text>
            {(weather?.message === 'Location not provided' || weather?.message === 'Invalid location') && (
              <Text style={styles.weatherHint}>Enable location for weather</Text>
            )}
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's plans</Text>
        {plans.length > 0 ? (
          plans.map((plan, idx) => (
            <View key={`${plan.slotLabel}-${idx}`} style={styles.planRow}>
              <Text style={styles.planSlot}>{plan.slotLabel}</Text>
              <Text style={styles.planOccasion} numberOfLines={1}>{plan.occasion || '—'}</Text>
              <Text style={styles.planStatus}>{plan.status}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No plans for today</Text>
          </View>
        )}
        <Pressable style={styles.calendarCard} onPress={goToCalendar}>
          <Text style={styles.calendarCardTitle}>Calendar / Plans</Text>
          <Text style={styles.calendarCardSubtitle}>View and plan outfits by day</Text>
        </Pressable>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scrollContent: { padding: theme.spacing.lg, paddingBottom: theme.spacing['2xl'] },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl },
    title: { fontSize: theme.typography.lg, color: theme.colors.textSecondary },
    loadingText: { marginTop: theme.spacing.md, fontSize: theme.typography.sm, color: theme.colors.textSecondary },
    header: { marginBottom: theme.spacing.lg },
    dateTitle: { fontSize: theme.typography.xl, fontWeight: '700', color: theme.colors.textPrimary },
    errorCard: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.error,
    },
    errorText: { fontSize: theme.typography.sm, color: theme.colors.error, marginBottom: theme.spacing.sm },
    retryButton: {
      alignSelf: 'flex-start',
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      backgroundColor: theme.colors.accent,
      borderRadius: theme.borderRadius.md,
    },
    retryButtonText: { fontSize: theme.typography.sm, fontWeight: '600', color: theme.colors.white },
    weatherCard: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    weatherMain: { fontSize: theme.typography.lg, fontWeight: '600', color: theme.colors.textPrimary },
    weatherMeta: { fontSize: theme.typography.xs, color: theme.colors.textTertiary, marginTop: theme.spacing.xs },
    weatherMessage: { fontSize: theme.typography.base, color: theme.colors.textSecondary },
    weatherHint: { fontSize: theme.typography.xs, color: theme.colors.textTertiary, marginTop: theme.spacing.xs },
    section: { marginBottom: theme.spacing.lg },
    sectionTitle: { fontSize: theme.typography.base, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: theme.spacing.md },
    planRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    planSlot: { fontSize: theme.typography.sm, fontWeight: '600', color: theme.colors.textPrimary, width: 90 },
    planOccasion: { flex: 1, fontSize: theme.typography.sm, color: theme.colors.textSecondary },
    planStatus: { fontSize: theme.typography.xs, color: theme.colors.textTertiary },
    emptyCard: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.xl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing.md,
    },
    emptyText: { fontSize: theme.typography.base, color: theme.colors.textSecondary },
    calendarCard: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginTop: theme.spacing.sm,
    },
    calendarCardTitle: { fontSize: theme.typography.base, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: theme.spacing.xs },
    calendarCardSubtitle: { fontSize: theme.typography.sm, color: theme.colors.textSecondary },
  });
}
