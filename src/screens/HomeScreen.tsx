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
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { fetchHomeToday, HomeTodayResponse } from '../api/home';
import { listLaundry } from '../api/wardrobe';
import { fetchForecast, ForecastDay } from '../api/weather';
import { useSettings } from '../store/settings';
import { useWeatherContext } from '../store/weatherContext';
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

// ─── CSS-drawn rotating boy avatars ──────────────────────────────────────────
// Three avatar variants that rotate every 2 days (casual → smart casual →
// formal → casual → …). All variants share the same overall dimensions,
// floating animation, face/ears/eyes/eyebrows/smile, neck, and ground shadow
// so the Home layout never shifts between rotations. Only hair, body
// (shirt/jacket/tie/watch), pants, and shoes change.
//
// Built entirely from <View> + borderRadius + transforms (no SVG, images, or
// gradients) to match the rest of the home screen's CSS-drawn aesthetic.
type AvatarVariant = 0 | 1 | 2;

// Rotation rule: bump to a new index every 2 whole days since the Unix epoch.
// Per spec — returns 0, 1, or 2.
function getAvatarIndex(): AvatarVariant {
  const daysSinceEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return (Math.floor(daysSinceEpoch / 2) % 3) as AvatarVariant;
}

function RotatingAvatar() {
  const variant = getAvatarIndex();
  return <AvatarFigure variant={variant} />;
}

// ─ Hair (per variant) ─────────────────────────────────────────────────────
function HairCasual() {
  return (
    <View style={avatarStyles.hair}>
      <View style={[avatarStyles.hairTop, { backgroundColor: '#5C4A3A' }]} />
      {/* Slightly taller top overlay for texture */}
      <View style={avatarStyles.hairCasualRidge} />
      <View style={[avatarStyles.bangLeft, { backgroundColor: '#5C4A3A' }]} />
      <View style={[avatarStyles.bangRight, { backgroundColor: '#5C4A3A' }]} />
    </View>
  );
}
function HairSmartCasual() {
  return (
    <View style={avatarStyles.hair}>
      <View style={[avatarStyles.hairTop, { backgroundColor: '#3D2B1F' }]} />
      {/* Wavy medium — two rotated lobes on top */}
      <View style={avatarStyles.hairWaveLeft} />
      <View style={avatarStyles.hairWaveRight} />
      <View style={[avatarStyles.bangLeft, { backgroundColor: '#3D2B1F' }]} />
      <View style={[avatarStyles.bangRight, { backgroundColor: '#3D2B1F' }]} />
    </View>
  );
}
function HairFormal() {
  return (
    <View style={avatarStyles.hair}>
      <View style={[avatarStyles.hairTop, { backgroundColor: '#2A1F14' }]} />
      {/* Neat side part — thin vertical gap on the left third */}
      <View style={avatarStyles.hairSidePart} />
      <View style={[avatarStyles.bangLeft, { backgroundColor: '#2A1F14' }]} />
      <View style={[avatarStyles.bangRight, { backgroundColor: '#2A1F14' }]} />
    </View>
  );
}

// ─ Shared head (face + neck, hair varies by variant) ──────────────────────
function AvatarHead({ variant }: Readonly<{ variant: AvatarVariant }>) {
  let HairComp: () => React.JSX.Element;
  if (variant === 0) HairComp = HairCasual;
  else if (variant === 1) HairComp = HairSmartCasual;
  else HairComp = HairFormal;
  const browColor = variant === 2 ? '#2A1F14' : '#5C4A3A';
  return (
    <>
      <HairComp />
      <View style={avatarStyles.face}>
        <View style={[avatarStyles.ear, avatarStyles.earLeft]} />
        <View style={[avatarStyles.ear, avatarStyles.earRight]} />

        {/* Curved eyebrows (3-sided border arc) */}
        <View style={avatarStyles.browRow}>
          <View style={[avatarStyles.brow, { borderColor: browColor }]} />
          <View style={[avatarStyles.brow, { borderColor: browColor }]} />
        </View>
        <View style={avatarStyles.eyeRow}>
          <View style={avatarStyles.eye} />
          <View style={avatarStyles.eye} />
        </View>
        <View style={avatarStyles.smile} />
      </View>
      <View style={avatarStyles.neck} />
    </>
  );
}

// ─ Variant 0 — CASUAL: cream knit polo + tan chinos + loafers ─────────────
function CasualBody() {
  return (
    <View style={casualStyles.torso}>
      {/* V-collar */}
      <View style={casualStyles.collarWrap}>
        <View style={casualStyles.collarLeft} />
        <View style={casualStyles.collarRight} />
      </View>
      {/* Two small gold buttons below collar */}
      <View style={casualStyles.buttonsWrap}>
        <View style={casualStyles.button} />
        <View style={[casualStyles.button, { marginTop: 5 }]} />
      </View>
      {/* Three horizontal knit-texture lines */}
      <View style={[casualStyles.knitLine, { top: 34 }]} />
      <View style={[casualStyles.knitLine, { top: 50 }]} />
      <View style={[casualStyles.knitLine, { top: 66 }]} />
      {/* Short sleeves with ribbed cuff + hand */}
      <View style={[casualStyles.sleeve, casualStyles.sleeveLeft]}>
        <View style={casualStyles.cuff} />
        <View style={casualStyles.hand} />
      </View>
      <View style={[casualStyles.sleeve, casualStyles.sleeveRight]}>
        <View style={casualStyles.cuff} />
        <View style={casualStyles.hand} />
      </View>
    </View>
  );
}
function CasualLowerBody() {
  return (
    <>
      <View style={casualStyles.beltRow}>
        <View style={casualStyles.belt}>
          <View style={casualStyles.buckle} />
        </View>
      </View>
      <View style={casualStyles.legsRow}>
        <View style={casualStyles.leg} />
        <View style={casualStyles.leg} />
      </View>
      <View style={casualStyles.shoesRow}>
        <View style={casualStyles.shoe}>
          <View style={casualStyles.shoeStrap} />
        </View>
        <View style={casualStyles.shoe}>
          <View style={casualStyles.shoeStrap} />
        </View>
      </View>
    </>
  );
}

// ─ Variant 1 — SMART CASUAL: turtleneck + camel overcoat + watch + boots ─
function SmartCasualBody() {
  return (
    <View style={smartStyles.torsoWrap}>
      {/* Inner turtleneck base */}
      <View style={smartStyles.turtleneck} />
      {/* Turtleneck fold peeking above collar */}
      <View style={smartStyles.turtleFold}>
        <View style={[smartStyles.turtleFoldLine, { top: 3 }]} />
        <View style={[smartStyles.turtleFoldLine, { top: 6 }]} />
      </View>
      {/* Overcoat — left panel (buttons + pocket flap + lapel stroke) */}
      <View style={[smartStyles.coatPanel, smartStyles.coatLeft]}>
        <View style={smartStyles.coatOverlay} />
        <View style={smartStyles.coatLapelLeft} />
        <View style={[smartStyles.coatButton, { top: 26 }]} />
        <View style={[smartStyles.coatButton, { top: 42 }]} />
        <View style={[smartStyles.coatPocketFlap, { bottom: 20 }]} />
      </View>
      {/* Overcoat — right panel */}
      <View style={[smartStyles.coatPanel, smartStyles.coatRight]}>
        <View style={smartStyles.coatOverlay} />
        <View style={smartStyles.coatLapelRight} />
        <View style={[smartStyles.coatPocketFlap, { bottom: 20 }]} />
      </View>
      {/* Sleeves rotated ±6°; watch on left wrist */}
      <View style={[smartStyles.sleeve, smartStyles.sleeveLeft]}>
        <View style={smartStyles.watchWrap}>
          <View style={smartStyles.watchStrap} />
          <View style={smartStyles.watchOuter}>
            <View style={smartStyles.watchFace} />
          </View>
          <View style={smartStyles.watchStrap} />
        </View>
        <View style={smartStyles.hand} />
      </View>
      <View style={[smartStyles.sleeve, smartStyles.sleeveRight]}>
        <View style={smartStyles.hand} />
      </View>
    </View>
  );
}
function SmartCasualLowerBody() {
  return (
    <>
      <View style={smartStyles.legsRow}>
        <View style={smartStyles.leg} />
        <View style={smartStyles.leg} />
      </View>
      <View style={smartStyles.shoesRow}>
        <View style={smartStyles.boot}>
          <View style={smartStyles.bootElasticLeft} />
          <View style={smartStyles.bootSole} />
        </View>
        <View style={smartStyles.boot}>
          <View style={smartStyles.bootElasticRight} />
          <View style={smartStyles.bootSole} />
        </View>
      </View>
    </>
  );
}

// ─ Variant 2 — FORMAL: white shirt + gold tie + blazer + oxfords ──────────
function FormalBody() {
  return (
    <View style={formalStyles.torsoWrap}>
      {/* Dress shirt with small collar points */}
      <View style={formalStyles.dressShirt}>
        <View style={formalStyles.collarPoints}>
          <View style={formalStyles.dressCollarLeft} />
          <View style={formalStyles.dressCollarRight} />
        </View>
      </View>
      {/* Gold silk tie — knot + tapered body + shine + darker overlay */}
      <View style={formalStyles.tieWrap}>
        <View style={formalStyles.tieKnot} />
        <View style={formalStyles.tieBody}>
          <View style={formalStyles.tieShine} />
          <View style={formalStyles.tieOverlay} />
        </View>
      </View>
      {/* Blazer — left panel with lapel, 2 gold buttons, breast pocket + square */}
      <View style={[formalStyles.blazerPanel, formalStyles.blazerLeft]}>
        <View style={formalStyles.blazerOverlay} />
        <View style={formalStyles.blazerLapelLeft} />
        <View style={[formalStyles.blazerButton, { top: 40 }]} />
        <View style={[formalStyles.blazerButton, { top: 54 }]} />
        <View style={formalStyles.breastPocket} />
        <View style={formalStyles.pocketSquare} />
      </View>
      {/* Blazer — right panel */}
      <View style={[formalStyles.blazerPanel, formalStyles.blazerRight]}>
        <View style={formalStyles.blazerOverlay} />
        <View style={formalStyles.blazerLapelRight} />
      </View>
      {/* Sleeves ±6° with shirt-cuff peek + hand */}
      <View style={[formalStyles.sleeve, formalStyles.sleeveLeft]}>
        <View style={formalStyles.cuffPeek} />
        <View style={formalStyles.hand} />
      </View>
      <View style={[formalStyles.sleeve, formalStyles.sleeveRight]}>
        <View style={formalStyles.cuffPeek} />
        <View style={formalStyles.hand} />
      </View>
    </View>
  );
}
function FormalLowerBody() {
  return (
    <>
      <View style={formalStyles.legsRow}>
        <View style={formalStyles.leg}>
          <View style={formalStyles.crease} />
        </View>
        <View style={formalStyles.leg}>
          <View style={formalStyles.crease} />
        </View>
      </View>
      <View style={formalStyles.shoesRow}>
        <View style={formalStyles.oxford}>
          <View style={formalStyles.oxfordCapLine} />
          <View style={formalStyles.oxfordSole} />
        </View>
        <View style={formalStyles.oxford}>
          <View style={formalStyles.oxfordCapLine} />
          <View style={formalStyles.oxfordSole} />
        </View>
      </View>
    </>
  );
}

function AvatarFigure({ variant }: Readonly<{ variant: AvatarVariant }>) {
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

  let Body: () => React.JSX.Element;
  let Lower: () => React.JSX.Element;
  if (variant === 0) { Body = CasualBody; Lower = CasualLowerBody; }
  else if (variant === 1) { Body = SmartCasualBody; Lower = SmartCasualLowerBody; }
  else { Body = FormalBody; Lower = FormalLowerBody; }

  return (
    <View style={avatarStyles.wrapper}>
      {/* Radial glow behind */}
      <View style={avatarStyles.glow} />

      <Animated.View style={[avatarStyles.figure, { transform: [{ translateY: floatAnim }] }]}>
        <AvatarHead variant={variant} />
        <Body />
        <Lower />
      </Animated.View>

      {/* Ground shadow — same for all variants (approximated as a flat ellipse
          since RN has no radial gradient without SVG; low-opacity dark fill
          reads as a soft grounded shadow against the warm beige backdrop). */}
      <View style={avatarStyles.groundShadow} />
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [forecastDays, setForecastDays] = useState<ForecastDay[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [laundryCount, setLaundryCount] = useState(0);

  // TODO: REMOVE DEBUG AVATAR SWITCHER BEFORE PRODUCTION
  const [debugAvatarOverride, setDebugAvatarOverride] = useState<number | null>(null);
  const avatarIndex = debugAvatarOverride !== null ? debugAvatarOverride : getAvatarIndex();

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
          useWeatherContext.getState().setLocation(pos.coords.latitude, pos.coords.longitude);
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
      // Publish weather to shared store so suggestion screens can use it.
      const w = result?.weather;
      if (w?.ok && w.tempF != null) {
        useWeatherContext.getState().setWeather(w.tempF, w.condition ?? null);
      }
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
            <Ionicons name="home" size={22} color={P.accent} style={{ marginLeft: 6 }} />
          </View>
          <View style={styles.headerRight}>
            <PillBtn onPress={toggleWeatherPopup} style={styles.pillGap}>
              <Ionicons name="sunny-outline" size={15} color={P.secondaryText} />
              <Text style={styles.pillText}>{todayTemp != null ? `${convertTemp(todayTemp, temperatureUnit)}°` : '—'}</Text>
            </PillBtn>
            <PillBtn onPress={() => goTo('Calendar')} style={styles.pillGap}>
              <Ionicons name="calendar-outline" size={15} color={P.secondaryText} />
            </PillBtn>
            <PillBtn onPress={() => goTo('Closet')} style={styles.pillGap}>
              <Ionicons name="shirt-outline" size={15} color={P.secondaryText} />
            </PillBtn>
            <PillBtn onPress={() => setProfileOpen(prev => !prev)}>
              <Ionicons name="person-outline" size={15} color={P.secondaryText} />
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
          <AvatarFigure variant={avatarIndex as AvatarVariant} />
        </View>

        {/* TODO: REMOVE DEBUG AVATAR SWITCHER BEFORE PRODUCTION */}
        <View style={styles.debugDotRow}>
          {[0, 1, 2].map((i) => {
            const isActive = avatarIndex === i;
            return (
              <Pressable
                key={i}
                onPress={() => setDebugAvatarOverride(i)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Show avatar variant ${i}`}
                style={[styles.debugDot, isActive && styles.debugDotActive]}
              />
            );
          })}
        </View>

        {/* ── CTA button ─────────────────────────────────────────────────── */}
        <Pressable
          style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.85 }]}
          onPress={() => navigation.navigate('Avatar3DScreen', { intent: 'today' })}
        >
          <Text style={styles.ctaBtnText}>PLAN MY OUTFIT OF THE DAY</Text>
          <View style={styles.ctaIcons}>
            <Ionicons name="shirt-outline" size={16} color={P.primaryText} />
            <Ionicons name="sparkles" size={16} color={P.accent} />
          </View>
        </Pressable>

        {/* ── 3 info cards ───────────────────────────────────────────────── */}
        <View style={styles.infoRow}>
          {/* Weather — backend only */}
          <InfoCard width={infoCardW}>
            <Ionicons name="cloud-outline" size={20} color={P.secondaryText} style={{ marginBottom: 2 }} />
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
              <Ionicons name="sparkles" size={10} color={P.accent} />
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

      {profileOpen && (
        <>
          <Pressable
            style={[StyleSheet.absoluteFill, styles.weatherBackdrop]}
            onPress={() => setProfileOpen(false)}
          />
          <View style={[styles.weatherPanel, { top: HEADER_H + (insets?.top ?? 0), right: H_PAD }]}>
            <View style={CARD_SHADOW}>
              <View style={[styles.weatherCard, { paddingTop: 18, paddingHorizontal: 14, paddingBottom: 12 }]}>
                <View style={styles.profileHeaderRow}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.profileAvatar}>
                      <Text style={styles.profileAvatarInitial}>
                        {(
                          user?.profile?.preferredName ??
                          user?.displayName ??
                          user?.username ??
                          user?.email ??
                          '?'
                        ).charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.profileNameBlock}>
                      <Text style={styles.profileName}>
                        {user?.profile?.preferredName ??
                          user?.displayName ??
                          user?.username ??
                          'My Profile'}
                      </Text>
                      {user?.email ? (
                        <Text style={styles.profileEmail} numberOfLines={1}>
                          {user.email}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                </View>

                {/* Divider */}
                <View style={styles.profileDivider} />

                {/* Quick actions */}
                <Pressable
                  style={styles.profileAction}
                  onPress={() => { setProfileOpen(false); goTo('Settings'); }}>
                  <Ionicons name="settings-outline" size={14} color={P.secondaryText} />
                  <Text style={styles.profileActionText}>Settings</Text>
                </Pressable>

                <Pressable
                  style={styles.profileAction}
                  onPress={() => { setProfileOpen(false); goTo('Saved'); }}>
                  <Ionicons name="star-outline" size={14} color={P.secondaryText} />
                  <Text style={styles.profileActionText}>Saved Outfits</Text>
                </Pressable>

                <Pressable
                  style={styles.profileAction}
                  onPress={() => { setProfileOpen(false); goTo('Favorites'); }}>
                  <Ionicons name="heart-outline" size={14} color={P.secondaryText} />
                  <Text style={styles.profileActionText}>Favorites</Text>
                </Pressable>

              </View>
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Avatar figure styles ────────────────────────────────────────────────────
// Shared (wrapper, glow, face/eyes/brows/smile/ears, neck, hair shell,
// ground shadow). Variant-specific styles live in casualStyles / smartStyles
// / formalStyles below.
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
  // Ground shadow ellipse (flat low-opacity pill, approximating a radial
  // fade since RN has no radial gradient without SVG).
  groundShadow: {
    position: 'absolute',
    bottom: 14,
    width: 72,
    height: 10,
    borderRadius: 36,
    backgroundColor: 'rgba(61,52,38,0.08)',
  },

  // Hair — shell shared across variants
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
  },
  hairCasualRidge: {
    position: 'absolute',
    top: -2,
    left: 10,
    right: 10,
    height: 12,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#4A3828',
  },
  hairWaveLeft: {
    position: 'absolute',
    top: -4,
    left: 8,
    width: 26,
    height: 12,
    borderRadius: 12,
    backgroundColor: '#3D2B1F',
    transform: [{ rotate: '-8deg' }],
  },
  hairWaveRight: {
    position: 'absolute',
    top: -4,
    right: 8,
    width: 26,
    height: 12,
    borderRadius: 12,
    backgroundColor: '#3D2B1F',
    transform: [{ rotate: '8deg' }],
  },
  hairSidePart: {
    position: 'absolute',
    top: 3,
    left: 26,
    width: 2,
    height: 22,
    backgroundColor: '#1A1208',
    opacity: 0.6,
  },
  bangLeft: {
    position: 'absolute',
    bottom: -6,
    left: 2,
    width: 16,
    height: 18,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 4,
  },
  bangRight: {
    position: 'absolute',
    bottom: -6,
    right: 2,
    width: 14,
    height: 14,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 10,
  },

  // Face (shared)
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
  // Eyebrows — 3-sided rounded border forms a small arched stroke above each eye.
  browRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 2,
  },
  brow: {
    width: 9,
    height: 4,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomWidth: 0,
    backgroundColor: 'transparent',
  },
  eyeRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 1,
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
    marginTop: 7,
  },

  // Neck (shared)
  neck: {
    width: 18,
    height: 10,
    backgroundColor: P.skinDark,
    zIndex: 0,
  },
});

// ─ Variant 0 (Casual) — cream knit polo + tan chinos + loafers ────────────
const casualStyles = StyleSheet.create({
  torso: {
    width: 84,
    height: 82,
    borderRadius: 8,
    backgroundColor: '#EDE6D8',
    alignItems: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  collarWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 2,
  },
  collarLeft: {
    width: 12,
    height: 14,
    backgroundColor: '#F5F0E8',
    borderWidth: 1,
    borderColor: '#D4C5B0',
    borderBottomRightRadius: 12,
    transform: [{ rotate: '14deg' }],
    marginRight: -2,
  },
  collarRight: {
    width: 12,
    height: 14,
    backgroundColor: '#F5F0E8',
    borderWidth: 1,
    borderColor: '#D4C5B0',
    borderBottomLeftRadius: 12,
    transform: [{ rotate: '-14deg' }],
    marginLeft: -2,
  },
  buttonsWrap: {
    alignItems: 'center',
    marginTop: 3,
  },
  button: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(196,168,130,0.5)',
  },
  knitLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(212,197,176,0.4)',
  },
  sleeve: {
    position: 'absolute',
    width: 18,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#EDE6D8',
    top: 6,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sleeveLeft: {
    left: -12,
    transform: [{ rotate: '-8deg' }],
  },
  sleeveRight: {
    right: -12,
    transform: [{ rotate: '8deg' }],
  },
  cuff: {
    position: 'absolute',
    bottom: 0,
    width: 18,
    height: 5,
    backgroundColor: 'rgba(212,197,176,0.4)',
  },
  hand: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: P.skin,
    marginBottom: -14,
  },
  beltRow: {
    alignItems: 'center',
  },
  belt: {
    width: 48,
    height: 4,
    backgroundColor: '#A8896A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buckle: {
    position: 'absolute',
    width: 6,
    height: 6,
    backgroundColor: P.accent,
  },
  legsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  leg: {
    width: 18,
    height: 60,
    backgroundColor: '#C4B08B',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  shoesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  shoe: {
    width: 22,
    height: 11,
    borderRadius: 5,
    backgroundColor: '#A8896A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shoeStrap: {
    width: 14,
    height: 3,
    backgroundColor: 'rgba(140,126,106,0.4)',
  },
});

// ─ Variant 1 (Smart Casual) — turtleneck + camel overcoat + watch + boots ─
const smartStyles = StyleSheet.create({
  torsoWrap: {
    width: 100,
    height: 86,
    alignItems: 'center',
    position: 'relative',
  },
  turtleneck: {
    width: 72,
    height: 80,
    borderRadius: 6,
    backgroundColor: '#5C4A3A',
    marginTop: 4,
    zIndex: 1,
  },
  turtleFold: {
    position: 'absolute',
    top: -2,
    width: 28,
    height: 10,
    borderRadius: 4,
    backgroundColor: '#5C4A3A',
    zIndex: 2,
    overflow: 'hidden',
  },
  turtleFoldLine: {
    position: 'absolute',
    left: 2,
    right: 2,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(74,56,40,0.5)',
  },
  coatPanel: {
    position: 'absolute',
    width: 40,
    height: 86,
    borderRadius: 5,
    backgroundColor: P.accent,
    top: 0,
    overflow: 'hidden',
    zIndex: 3,
  },
  coatLeft:  { left: 0 },
  coatRight: { right: 0 },
  coatOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(168,137,106,0.2)',
  },
  // Diagonal lapel stroke, approximated as a thin rotated rect.
  coatLapelLeft: {
    position: 'absolute',
    top: 8,
    right: 2,
    width: 22,
    height: 1.5,
    backgroundColor: '#A8896A',
    transform: [{ rotate: '-38deg' }],
  },
  coatLapelRight: {
    position: 'absolute',
    top: 8,
    left: 2,
    width: 22,
    height: 1.5,
    backgroundColor: '#A8896A',
    transform: [{ rotate: '38deg' }],
  },
  coatButton: {
    position: 'absolute',
    right: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#8C7E6A',
  },
  coatPocketFlap: {
    position: 'absolute',
    alignSelf: 'center',
    width: 24,
    height: 3,
    backgroundColor: 'rgba(168,137,106,0.4)',
  },
  sleeve: {
    position: 'absolute',
    width: 18,
    height: 50,
    borderRadius: 8,
    backgroundColor: P.accent,
    top: 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 4,
  },
  sleeveLeft: {
    left: -14,
    transform: [{ rotate: '-6deg' }],
  },
  sleeveRight: {
    right: -14,
    transform: [{ rotate: '6deg' }],
  },
  watchWrap: {
    alignItems: 'center',
    marginBottom: 2,
  },
  watchStrap: {
    width: 7,
    height: 3,
    backgroundColor: 'rgba(168,137,106,0.6)',
  },
  watchOuter: {
    width: 10,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.3,
    borderColor: P.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  watchFace: {
    width: 6,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(196,168,130,0.25)',
  },
  hand: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: P.skin,
    marginBottom: -14,
  },
  legsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  leg: {
    width: 18,
    height: 56,
    backgroundColor: '#3D3426',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  shoesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  boot: {
    width: 22,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#5C4A3A',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  // Elastic panel on the inner side of each boot (left boot → right edge;
  // right boot → left edge — faces each other).
  bootElasticLeft: {
    position: 'absolute',
    top: 3,
    right: 2,
    width: 4,
    height: 8,
    borderRadius: 2,
    backgroundColor: 'rgba(140,126,106,0.3)',
  },
  bootElasticRight: {
    position: 'absolute',
    top: 3,
    left: 2,
    width: 4,
    height: 8,
    borderRadius: 2,
    backgroundColor: 'rgba(140,126,106,0.3)',
  },
  bootSole: {
    width: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4A3828',
  },
});

// ─ Variant 2 (Formal) — white dress shirt + gold tie + blazer + oxfords ───
const formalStyles = StyleSheet.create({
  torsoWrap: {
    width: 96,
    height: 82,
    alignItems: 'center',
    position: 'relative',
  },
  dressShirt: {
    width: 68,
    height: 80,
    borderRadius: 5,
    backgroundColor: '#F5F0E8',
    alignItems: 'center',
    marginTop: 2,
    zIndex: 1,
  },
  collarPoints: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 2,
  },
  dressCollarLeft: {
    width: 10,
    height: 14,
    backgroundColor: '#F5F0E8',
    borderWidth: 1,
    borderColor: '#E8E0D0',
    borderBottomRightRadius: 10,
    transform: [{ rotate: '16deg' }],
    marginRight: -1,
  },
  dressCollarRight: {
    width: 10,
    height: 14,
    backgroundColor: '#F5F0E8',
    borderWidth: 1,
    borderColor: '#E8E0D0',
    borderBottomLeftRadius: 10,
    transform: [{ rotate: '-16deg' }],
    marginLeft: -1,
  },
  // Gold silk tie — knot at top + tapered body below.
  tieWrap: {
    position: 'absolute',
    top: 14,
    alignItems: 'center',
    zIndex: 2,
  },
  tieKnot: {
    width: 8,
    height: 8,
    backgroundColor: P.accent,
    transform: [{ rotate: '45deg' }],
  },
  tieBody: {
    width: 4,
    height: 56,
    backgroundColor: P.accent,
    marginTop: -2,
    alignItems: 'center',
    overflow: 'hidden',
  },
  tieShine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(232,217,197,0.3)',
  },
  tieOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(168,137,106,0.25)',
  },
  blazerPanel: {
    position: 'absolute',
    width: 38,
    height: 82,
    borderRadius: 5,
    backgroundColor: '#5C4A3A',
    top: 0,
    overflow: 'hidden',
    zIndex: 3,
  },
  blazerLeft:  { left: 0 },
  blazerRight: { right: 0 },
  blazerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(74,56,40,0.2)',
  },
  // Notch-lapel diagonal strokes, approximated as rotated thin rects.
  blazerLapelLeft: {
    position: 'absolute',
    top: 10,
    right: 2,
    width: 22,
    height: 1,
    backgroundColor: '#4A3828',
    transform: [{ rotate: '-40deg' }],
  },
  blazerLapelRight: {
    position: 'absolute',
    top: 10,
    left: 2,
    width: 22,
    height: 1,
    backgroundColor: '#4A3828',
    transform: [{ rotate: '40deg' }],
  },
  blazerButton: {
    position: 'absolute',
    right: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: P.accent,
  },
  breastPocket: {
    position: 'absolute',
    top: 22,
    left: 8,
    width: 14,
    height: 2,
    backgroundColor: 'rgba(74,56,40,0.4)',
  },
  // Small pocket square peeking out, rotated for a folded-triangle feel.
  pocketSquare: {
    position: 'absolute',
    top: 20,
    left: 12,
    width: 6,
    height: 5,
    backgroundColor: 'rgba(232,217,197,0.7)',
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
    transform: [{ rotate: '-12deg' }],
  },
  sleeve: {
    position: 'absolute',
    width: 18,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#5C4A3A',
    top: 12,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 4,
  },
  sleeveLeft: {
    left: -12,
    transform: [{ rotate: '-6deg' }],
  },
  sleeveRight: {
    right: -12,
    transform: [{ rotate: '6deg' }],
  },
  cuffPeek: {
    position: 'absolute',
    bottom: 0,
    width: 18,
    height: 5,
    backgroundColor: 'rgba(245,240,232,0.7)',
  },
  hand: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: P.skin,
    marginBottom: -14,
  },
  legsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  leg: {
    width: 18,
    height: 60,
    backgroundColor: '#3D3426',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    alignItems: 'center',
  },
  crease: {
    width: StyleSheet.hairlineWidth,
    height: 60,
    backgroundColor: 'rgba(42,31,20,0.3)',
  },
  shoesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  oxford: {
    width: 22,
    height: 12,
    borderRadius: 5,
    backgroundColor: '#4A3828',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  oxfordCapLine: {
    position: 'absolute',
    top: 4,
    left: 0,
    width: 7,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(61,43,31,0.3)',
  },
  oxfordSole: {
    width: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3D2B1F',
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
  headerIcon: {
    marginLeft: 6,
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
  pillIcon: { },
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

  // TODO: REMOVE DEBUG AVATAR SWITCHER BEFORE PRODUCTION
  debugDotRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 12,
    marginBottom: 12,
  },
  debugDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: P.border,
  },
  debugDotActive: {
    width: 24,
    backgroundColor: P.accent,
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
  ctaIcon: {
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
  infoIcon:   { marginBottom: 2 },
  infoTitle:  { fontSize: 10, fontWeight: '700', color: P.secondaryText, letterSpacing: 0.5, marginBottom: 4, textAlign: 'center' },
  infoValue:  { fontSize: 18, fontWeight: '700', color: P.primaryText, marginTop: 2 },
  infoLabel:  { fontSize: 11, color: P.secondaryText, marginTop: 2 },
  infoMeta:   { fontSize: 10, color: P.lightText, marginTop: 2 },
  factHeader: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  factIcon:   { },
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
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 0,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#C4A882',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  profileAvatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileNameBlock: {
    flex: 1,
  },
  profileName: {
    fontSize: 15,
    fontWeight: '700',
    color: P.primaryText,
  },
  profileEmail: {
    fontSize: 11,
    color: P.secondaryText,
    marginTop: 2,
  },
  profileDivider: {
    height: 1,
    backgroundColor: 'rgba(196,168,130,0.2)',
    marginVertical: 8,
  },
  profileCloseBtn: {
    flexShrink: 0,
    padding: 2,
  },
  profileAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(196,168,130,0.07)',
    marginBottom: 6,
  },
  profileActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: P.primaryText,
    flex: 1,
    textAlign: 'left',
  },
});
