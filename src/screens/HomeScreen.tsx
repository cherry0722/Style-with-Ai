/**
 * Home tab — GET /api/home/today.
 * Warm beige palette, CSS-drawn avatar, pressable CTA, 3 info cards, weather popup.
 *
 * MyraNative migration: expo-location → react-native-geolocation-service.
 * Only loadLocation() changed; all other logic, layout, and styles are verbatim.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Geolocation from 'react-native-geolocation-service';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { fetchHomeToday, HomeTodayResponse } from '../api/home';
import { listLaundry } from '../api/wardrobe';
import { fetchForecast, ForecastDay } from '../api/weather';
import { useSettings } from '../store/settings';
import { convertTemp, tempLabel } from '../utils/temperature';

const H_PAD = 24;
const HEADER_H = 56;
const GRID_GAP = 10;
const BOTTOM_RESERVE = 88;

const P = {
  background:     '#F5F0E8',
  cardSurface:    '#EDE6D8',
  cardWhite:      '#FFFFFF',
  primaryText:    '#3D3426',
  secondaryText:  '#8C7E6A',
  lightText:      '#B5A894',
  accent:         '#C4A882',
  accentLight:    '#E8D9C5',
  border:         '#E8E0D0',
  bottomBar:      '#FAF7F2',
  shadow:         'rgba(61, 52, 38, 0.08)',
  skin:           '#DEAD8F',
  skinDark:       '#C9956E',
  hair:           '#5C4A3A',
  pants:          '#4A5568',
  shoes:          '#F0EDE6',
} as const;

const CARD_SHADOW = {
  shadowColor: P.shadow,
  shadowOpacity: 1,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
};

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });

function formatTodayLabel(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return 'Today';
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function iconForCondition(c: string | null): keyof typeof Ionicons.glyphMap {
  if (!c) return 'partly-sunny';
  const lc = c.toLowerCase();
  if (lc.includes('rain') || lc.includes('drizzle')) return 'rainy';
  if (lc.includes('cloud')) return 'cloudy';
  if (lc.includes('clear') || lc.includes('sun')) return 'sunny';
  if (lc.includes('snow')) return 'snow';
  if (lc.includes('thunder')) return 'thunderstorm';
  return 'partly-sunny';
}

// ─── Pill-style header button ────────────────────────────────────────────────
function PillBtn({
  children,
  onPress,
  style,
}: Readonly<{ children: React.ReactNode; onPress: () => void; style?: object }>) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pillBtn, style, pressed && { opacity: 0.7 }]}
      hitSlop={6}
      accessibilityRole="button"
    >
      {children}
    </Pressable>
  );
}

// ─── CSS-drawn avatar character ──────────────────────────────────────────────
function AvatarFigure() {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim]);

  return (
    <View style={avatarStyles.wrapper}>
      {/* Radial glow behind */}
      <View style={avatarStyles.glow} />

      <Animated.View style={[avatarStyles.figure, { transform: [{ translateY: floatAnim }] }]}>
        {/* Hair */}
        <View style={avatarStyles.hair}>
          <View style={avatarStyles.hairTop} />
          <View style={avatarStyles.bangLeft} />
          <View style={avatarStyles.bangRight} />
        </View>

        {/* Face */}
        <View style={avatarStyles.face}>
          {/* Ears */}
          <View style={[avatarStyles.ear, avatarStyles.earLeft]} />
          <View style={[avatarStyles.ear, avatarStyles.earRight]} />
          {/* Eyes */}
          <View style={avatarStyles.eyeRow}>
            <View style={avatarStyles.eye} />
            <View style={avatarStyles.eye} />
          </View>
          {/* Smile */}
          <View style={avatarStyles.smile} />
        </View>

        {/* Neck */}
        <View style={avatarStyles.neck} />

        {/* Torso / shirt */}
        <View style={avatarStyles.torso}>
          {/* Collar V */}
          <View style={avatarStyles.collarV}>
            <View style={avatarStyles.collarLeft} />
            <View style={avatarStyles.collarRight} />
          </View>
          {/* Arms */}
          <View style={[avatarStyles.arm, avatarStyles.armLeft]}>
            <View style={avatarStyles.hand} />
          </View>
          <View style={[avatarStyles.arm, avatarStyles.armRight]}>
            <View style={avatarStyles.hand} />
          </View>
        </View>

        {/* Legs */}
        <View style={avatarStyles.legsRow}>
          <View style={avatarStyles.leg} />
          <View style={avatarStyles.leg} />
        </View>

        {/* Shoes */}
        <View style={avatarStyles.shoesRow}>
          <View style={avatarStyles.shoe} />
          <View style={avatarStyles.shoe} />
        </View>
      </Animated.View>
    </View>
  );
}

// ─── Info card wrapper ───────────────────────────────────────────────────────
function InfoCard({ width, children }: Readonly<{ width: number; children: React.ReactNode }>) {
  return (
    <View style={[styles.infoCard, { width }, CARD_SHADOW]}>
      {children}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();

  const [data, setData]             = useState<HomeTodayResponse | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [forecastDays, setForecastDays] = useState<ForecastDay[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [laundryCount, setLaundryCount] = useState(0);

  const { width: screenW, height: screenH } = Dimensions.get('window');
  const containerW  = screenW - H_PAD * 2;
  const avatarH     = Math.max(280, Math.min(screenH * 0.48, 440));
  const infoCardW   = (containerW - GRID_GAP * 2) / 3;
  const bottomPad   = BOTTOM_RESERVE + (insets?.bottom ?? 0);

  // ── Location (react-native-geolocation-service, replaces expo-location) ────
  const loadLocation = useCallback(() => {
    const doGetPosition = () => {
      Geolocation.getCurrentPosition(
        (pos) => {
          setLocationDenied(false);
          setLocationCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        },
        () => {
          setLocationDenied(true);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 },
      );
    };

    if (Platform.OS === 'ios') {
      Geolocation.requestAuthorization('whenInUse')
        .then((auth) => {
          if (auth === 'granted') {
            doGetPosition();
          } else {
            setLocationDenied(true);
          }
        })
        .catch(() => setLocationDenied(true));
    } else {
      // Android: ACCESS_FINE_LOCATION must be declared in AndroidManifest.xml
      doGetPosition();
    }
  }, []);

  // ── Data fetching (unchanged from Expo app) ───────────────────────────────
  const loadHomeToday = useCallback(async () => {
    if (!token) { setLoading(false); setData(null); return; }
    try {
      setError(null);
      const params = locationCoords ? { lat: locationCoords.lat, lon: locationCoords.lon } : undefined;
      const result = await fetchHomeToday(params);
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error');
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, locationCoords]);

  useEffect(() => { loadLocation(); }, [loadLocation]);
  useEffect(() => {
    if (!token) { setLoading(false); setData(null); return; }
    setLoading(true);
    loadHomeToday();
  }, [token, locationCoords]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadLaundryCount = useCallback(async () => {
    if (!token) { setLaundryCount(0); return; }
    try {
      const result = await listLaundry(false);
      setLaundryCount(result.count ?? result.items?.length ?? 0);
    } catch { setLaundryCount(0); }
  }, [token]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => { void loadLaundryCount(); });
    return unsubscribe;
  }, [navigation, loadLaundryCount]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadHomeToday(); loadLaundryCount(); }, [loadHomeToday, loadLaundryCount]);

  const goTo = useCallback((screen: string) => {
    try { navigation.navigate(screen); } catch { /* no-op */ }
  }, [navigation]);

  // ── Derived weather values (backend only) ────────────────────────────────
  const weather        = data?.weather;
  const weatherOk      = weather?.ok === true && weather.tempF != null;
  const temperatureUnit = useSettings(s => s.temperatureUnit);
  const todayTemp      = weatherOk ? Math.round(weather!.tempF!) : null;
  const todayCondition = weatherOk && weather!.condition ? weather!.condition : null;
  const todayDateStr   = data?.date ? formatTodayLabel(data.date) : 'Today';

  const loadForecast = useCallback(async () => {
    if (!locationCoords) return;
    setForecastLoading(true);
    try {
      const res = await fetchForecast(locationCoords.lat, locationCoords.lon);
      setForecastDays(res.days ?? []);
    } catch {
      setForecastDays([]);
    } finally {
      setForecastLoading(false);
    }
  }, [locationCoords]);

  const toggleWeatherPopup = useCallback(() => {
    setWeatherOpen((prev) => {
      const opening = !prev;
      if (opening && forecastDays.length === 0) void loadForecast();
      return opening;
    });
  }, [forecastDays.length, loadForecast]);

  // ── Auth / loading guards ─────────────────────────────────────────────────
  if (!user) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.centerText}>Sign in to see your day</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !data) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={P.accent} />
          <Text style={[styles.centerText, { marginTop: 12 }]}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: H_PAD, paddingBottom: bottomPad }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={P.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top row ────────────────────────────────────────────────────── */}
        <View style={[styles.headerRow, { height: HEADER_H }]}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>HOME</Text>
            <Text style={styles.headerEmoji}> 🏠</Text>
          </View>
          <View style={styles.headerRight}>
            <PillBtn onPress={toggleWeatherPopup} style={styles.pillGap}>
              <Text style={styles.pillEmoji}>☀️</Text>
              <Text style={styles.pillText}>{todayTemp != null ? `${convertTemp(todayTemp, temperatureUnit)}°` : '—'}</Text>
            </PillBtn>
            <PillBtn onPress={() => goTo('Calendar')} style={styles.pillGap}>
              <Text style={styles.pillEmoji}>📅</Text>
            </PillBtn>
            <PillBtn onPress={() => goTo('Closet')} style={styles.pillGap}>
              <Text style={styles.pillEmoji}>👔</Text>
            </PillBtn>
            <PillBtn onPress={() => goTo('Settings')}>
              <Text style={styles.pillEmoji}>👤</Text>
            </PillBtn>
          </View>
        </View>

        {/* ── Error banner ───────────────────────────────────────────────── */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText} numberOfLines={1}>{error}</Text>
            <Pressable onPress={() => { setLoading(true); loadHomeToday(); }} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* ── Avatar area (~55% height) ──────────────────────────────────── */}
        <View style={[styles.avatarArea, { height: avatarH }]}>
          <AvatarFigure />
        </View>

        {/* ── CTA button ─────────────────────────────────────────────────── */}
        <Pressable
          style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.85 }]}
          onPress={() => goTo('Outfits')}
        >
          <Text style={styles.ctaBtnText}>PLAN MY OUTFIT OF THE DAY</Text>
          <View style={styles.ctaIcons}>
            <Text style={styles.ctaEmoji}>👔</Text>
            <Text style={styles.ctaEmoji}>✨</Text>
          </View>
        </Pressable>

        {/* ── 3 info cards ───────────────────────────────────────────────── */}
        <View style={styles.infoRow}>
          {/* Weather — backend only */}
          <InfoCard width={infoCardW}>
            <Text style={styles.infoEmoji}>☁️</Text>
            {locationDenied ? (
              <>
                <Text style={styles.infoValue}>—</Text>
                <Text style={[styles.infoLabel, { fontSize: 9 }]} numberOfLines={2}>Enable location for weather</Text>
              </>
            ) : todayTemp != null ? (
              <>
                <Text style={styles.infoValue}>
                  {todayTemp != null ? tempLabel(todayTemp, temperatureUnit) : '—'}
                </Text>
                <Text style={styles.infoLabel} numberOfLines={1}>{todayCondition ?? 'Mild'}</Text>
                <Text style={styles.infoMeta}>{todayDateStr}</Text>
              </>
            ) : (
              <>
                <Text style={styles.infoValue}>—</Text>
                <Text style={styles.infoLabel} numberOfLines={1}>Unavailable</Text>
                <Pressable onPress={onRefresh} hitSlop={8}>
                  <Text style={[styles.infoMeta, { color: P.accent }]}>Retry</Text>
                </Pressable>
              </>
            )}
          </InfoCard>
          {/* Laundry */}
          <Pressable onPress={() => goTo('Laundry')} style={{ width: infoCardW }}>
            <InfoCard width={infoCardW}>
              <Text style={styles.infoTitle}>IN LAUNDRY</Text>
              <Text style={styles.infoValue}>{laundryCount}</Text>
              <Text style={styles.infoMeta}>items</Text>
            </InfoCard>
          </Pressable>
          {/* Fashion fact */}
          <InfoCard width={infoCardW}>
            <View style={styles.factHeader}>
              <Text style={styles.infoTitle}>Fashion Fact</Text>
              <Text style={styles.factSparkle}>✨</Text>
            </View>
            <Text style={styles.infoFact}>Neutral tones pair with any accent.</Text>
          </InfoCard>
        </View>
      </ScrollView>

      {/* ── Weather popup overlay (unchanged logic) ──────────────────────── */}
      {weatherOpen && (
        <>
          <Pressable
            style={[StyleSheet.absoluteFill, styles.weatherBackdrop]}
            onPress={() => setWeatherOpen(false)}
          />
          <View style={[styles.weatherPanel, { top: HEADER_H + (insets?.top ?? 0), right: H_PAD }]}>
            <View style={CARD_SHADOW}>
              <View style={styles.weatherCard}>
                <View style={styles.weatherHeader}>
                  <Text style={styles.weatherTitle}>Next 7 days</Text>
                  <Pressable onPress={() => setWeatherOpen(false)} hitSlop={12}>
                    <Ionicons name="close" size={18} color={P.secondaryText} />
                  </Pressable>
                </View>
                {forecastLoading ? (
                  <View style={styles.forecastNote}>
                    <ActivityIndicator size="small" color={P.accent} />
                  </View>
                ) : forecastDays.length > 0 ? (
                  forecastDays.map((day) => (
                    <View key={day.dateISO} style={styles.weatherRow}>
                      <Text style={styles.weatherDay}>{day.label}</Text>
                      <Ionicons name={iconForCondition(day.summary)} size={18} color={P.secondaryText} />
                      <Text style={styles.weatherTemp}>
                        {convertTemp(day.tempHighF, temperatureUnit)}° / {convertTemp(day.tempLowF, temperatureUnit)}°
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.forecastNote}>
                    <Text style={styles.forecastNoteText}>
                      {locationDenied ? 'Enable location for forecast' : 'Forecast unavailable'}
                    </Text>
                    {!locationDenied && (
                      <Pressable onPress={loadForecast} hitSlop={8} style={{ marginTop: 6 }}>
                        <Text style={[styles.forecastNoteText, { color: P.accent, fontStyle: 'normal' }]}>Retry</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Avatar figure styles ────────────────────────────────────────────────────
const avatarStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: `${P.accentLight}54`,
    alignSelf: 'center',
  },
  figure: {
    alignItems: 'center',
  },

  // Hair
  hair: {
    width: 72,
    height: 34,
    position: 'relative',
    marginBottom: -8,
    zIndex: 2,
  },
  hairTop: {
    width: 72,
    height: 34,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    backgroundColor: P.hair,
  },
  bangLeft: {
    position: 'absolute',
    bottom: -6,
    left: 2,
    width: 16,
    height: 18,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 4,
    backgroundColor: P.hair,
  },
  bangRight: {
    position: 'absolute',
    bottom: -6,
    right: 2,
    width: 14,
    height: 14,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 10,
    backgroundColor: P.hair,
  },

  // Face
  face: {
    width: 64,
    height: 72,
    borderRadius: 32,
    backgroundColor: P.skin,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    overflow: 'visible',
  },
  ear: {
    position: 'absolute',
    width: 12,
    height: 16,
    borderRadius: 6,
    backgroundColor: P.skinDark,
    top: 26,
  },
  earLeft:  { left: -5 },
  earRight: { right: -5 },
  eyeRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  eye: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: P.primaryText,
  },
  smile: {
    width: 14,
    height: 7,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: P.primaryText,
    backgroundColor: 'transparent',
    marginTop: 8,
  },

  // Neck
  neck: {
    width: 18,
    height: 10,
    backgroundColor: P.skinDark,
    zIndex: 0,
  },

  // Torso
  torso: {
    width: 90,
    height: 80,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: P.accentLight,
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  collarV: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 2,
  },
  collarLeft: {
    width: 14,
    height: 14,
    borderBottomRightRadius: 14,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: P.accent,
    backgroundColor: 'transparent',
    transform: [{ rotate: '15deg' }],
    marginRight: -2,
  },
  collarRight: {
    width: 14,
    height: 14,
    borderBottomLeftRadius: 14,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: P.accent,
    backgroundColor: 'transparent',
    transform: [{ rotate: '-15deg' }],
    marginLeft: -2,
  },

  // Arms
  arm: {
    position: 'absolute',
    width: 20,
    height: 60,
    borderRadius: 10,
    backgroundColor: P.accentLight,
    top: 6,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 2,
  },
  armLeft:  { left: -14 },
  armRight: { right: -14 },
  hand: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: P.skin,
  },

  // Legs
  legsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 0,
  },
  leg: {
    width: 24,
    height: 52,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    backgroundColor: P.pants,
  },

  // Shoes
  shoesRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 0,
  },
  shoe: {
    width: 28,
    height: 12,
    borderRadius: 6,
    backgroundColor: P.shoes,
  },
});

// ─── Main styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.background },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: H_PAD },
  centerText:{ fontSize: 16, color: P.secondaryText },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: SERIF,
    fontSize: 30,
    fontWeight: '700',
    color: P.primaryText,
    letterSpacing: -0.5,
  },
  headerEmoji: {
    fontSize: 22,
    marginLeft: 4,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center' },

  // Pill buttons
  pillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: P.cardWhite,
    borderWidth: 1,
    borderColor: P.border,
    shadowColor: P.shadow,
    shadowOpacity: 1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    gap: 3,
  },
  pillGap: { marginRight: 6 },
  pillEmoji: { fontSize: 15 },
  pillText: { fontSize: 13, fontWeight: '600', color: P.primaryText },

  // Error
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.cardSurface,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  errorText: { flex: 1, fontSize: 13, color: P.primaryText },
  retryBtn:  { paddingVertical: 4, paddingHorizontal: 12, backgroundColor: P.border, borderRadius: 8 },
  retryText: { fontSize: 12, fontWeight: '600', color: P.primaryText },

  // Avatar area
  avatarArea: {
    alignSelf: 'center',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },

  // CTA
  ctaBtn: {
    width: '100%',
    height: 54,
    backgroundColor: P.cardWhite,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: P.border,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: P.shadow,
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  ctaBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: P.primaryText,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  ctaIcons: {
    flexDirection: 'row',
    marginLeft: 10,
    gap: 2,
  },
  ctaEmoji: {
    fontSize: 16,
  },

  // Info cards
  infoRow: { flexDirection: 'row', gap: GRID_GAP, marginBottom: 0 },
  infoCard: {
    backgroundColor: P.cardSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: P.border,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 110,
  },
  infoEmoji:  { fontSize: 20, marginBottom: 2 },
  infoTitle:  { fontSize: 10, fontWeight: '700', color: P.secondaryText, letterSpacing: 0.5, marginBottom: 4, textAlign: 'center' },
  infoValue:  { fontSize: 18, fontWeight: '700', color: P.primaryText, marginTop: 2 },
  infoLabel:  { fontSize: 11, color: P.secondaryText, marginTop: 2 },
  infoMeta:   { fontSize: 10, color: P.lightText, marginTop: 2 },
  factHeader: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  factSparkle:{ fontSize: 10 },
  infoFact:   { fontSize: 10, color: P.secondaryText, marginTop: 4, textAlign: 'center', lineHeight: 14 },

  // Weather overlay
  weatherBackdrop: { backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 100 },
  weatherPanel: { position: 'absolute', zIndex: 101, minWidth: 260, maxWidth: 320 },
  weatherCard: {
    backgroundColor: P.cardWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: P.border,
    overflow: 'hidden',
  },
  weatherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: P.border,
  },
  weatherTitle: { fontSize: 15, fontWeight: '600', color: P.primaryText },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: P.border,
  },
  weatherDay:  { fontSize: 14, color: P.primaryText, minWidth: 48 },
  weatherTemp: { fontSize: 14, fontWeight: '600', color: P.primaryText },
  forecastNote: { paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  forecastNoteText: { fontSize: 11, color: P.lightText, fontStyle: 'italic' },
});
