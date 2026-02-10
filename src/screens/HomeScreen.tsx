/**
 * Home tab — GET /api/home/today.
 * Layout: portrait avatar (78% width max 340, 44% height clamp 320–440), no-thumb slider (55% complete), tightened gaps, bottom fade into tab bar.
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
  PanResponder,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { fetchHomeToday, HomeTodayResponse } from '../api/home';

// Precision layout constants (px)
const HORIZONTAL_PADDING = 24;
const HEADER_HEIGHT = 60;
const CTA_HEIGHT = 90;
const CTA_INTERNAL_PADDING = 20;
const INFO_CARD_SIZE = 110;
const GRID_GAP = 12;
const BOTTOM_TAB_RESERVE = 80;
const BORDER_RADIUS = 16;

const PRECISION_SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.04,
  shadowRadius: 30,
  shadowOffset: { width: 0, height: 8 },
  elevation: 2,
};

const HOME_PALETTE = {
  background: '#F5F2EB',
  cardSurface: '#EBE6DA',
  primaryText: '#4A473E',
  secondaryText: '#8C887D',
  bottomBarSurface: '#FAF9F6',
  activeHighlight: '#D9D2C2',
} as const;

function formatTodayLabel(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return 'Today';
  const d = new Date(dateStr + 'T12:00:00Z');
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  return d.toLocaleDateString(undefined, options);
}

// Mock 7-day forecast for weather overlay (replace with real API later)
const MOCK_7_DAY_FORECAST = [
  { day: 'Today', icon: 'partly-sunny' as const, temp: 70 },
  { day: 'Tue', icon: 'cloudy' as const, temp: 68 },
  { day: 'Wed', icon: 'rainy' as const, temp: 65 },
  { day: 'Thu', icon: 'partly-sunny' as const, temp: 72 },
  { day: 'Fri', icon: 'sunny' as const, temp: 75 },
  { day: 'Sat', icon: 'cloudy' as const, temp: 71 },
  { day: 'Sun', icon: 'partly-sunny' as const, temp: 73 },
];

const MIN_TOUCH_TARGET = 44;
const SLIDER_CONFIRM_THRESHOLD = 0.55;
const AVATAR_WIDTH_PCT = 0.78;
const AVATAR_WIDTH_MAX = 340;
const AVATAR_HEIGHT_PCT = 0.44;
const AVATAR_HEIGHT_MIN = 320;
const AVATAR_HEIGHT_MAX = 440;
const PROGRESS_FILL_OPACITY = 0.08;

const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });

// --- Internal components (all inside HomeScreen.tsx) ---

function HeaderIconButton({
  onPress,
  icon,
  palette,
  style,
}: Readonly<{
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  palette: typeof HOME_PALETTE;
  style?: object;
}>) {
  const styles = headerIconButtonStyles(palette);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, style, pressed && styles.pressed]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityRole="button"
      accessibilityLabel={icon}
    >
      <Ionicons name={icon} size={22} color={palette.primaryText} />
    </Pressable>
  );
}

function headerIconButtonStyles(palette: typeof HOME_PALETTE) {
  return StyleSheet.create({
    button: {
      width: Math.max(MIN_TOUCH_TARGET, 44),
      height: Math.max(MIN_TOUCH_TARGET, 44),
      borderRadius: BORDER_RADIUS,
      backgroundColor: palette.cardSurface,
      borderWidth: 1,
      borderColor: palette.activeHighlight,
      justifyContent: 'center',
      alignItems: 'center',
      ...PRECISION_SHADOW,
    },
    pressed: { opacity: 0.7 },
  });
}

/** Info grid card: square, exactly 110px height, width from grid layout. */
function InfoCard({
  children,
  palette,
  width,
  style,
}: Readonly<{
  children: React.ReactNode;
  palette: typeof HOME_PALETTE;
  width: number;
  style?: object;
}>) {
  return (
    <View
      style={[
        {
          width,
          height: INFO_CARD_SIZE,
          backgroundColor: palette.cardSurface,
          borderRadius: BORDER_RADIUS,
          padding: 12,
          borderWidth: 1,
          borderColor: palette.activeHighlight,
          justifyContent: 'center',
          alignItems: 'center',
          ...PRECISION_SHADOW,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** CTA: track + centered text only. No visible thumb. Invisible full-width drag; subtle progress fill at low opacity. 55% completes. */
function DragToConfirmSlider({
  label,
  onConfirm,
  palette,
  width,
}: Readonly<{
  label: string;
  onConfirm: () => void;
  palette: typeof HOME_PALETTE;
  width: number;
}>) {
  const trackHeight = CTA_HEIGHT - CTA_INTERNAL_PADDING * 2;
  const trackWidth = Math.max(width - CTA_INTERNAL_PADDING * 2, 200);
  const maxDrag = trackWidth;
  const threshold = maxDrag * SLIDER_CONFIRM_THRESHOLD;

  const progressAnim = useRef(new Animated.Value(0)).current;
  const lastOffsetRef = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3,
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, g) => {
        const dx = Math.max(0, Math.min(g.dx, maxDrag));
        lastOffsetRef.current = dx;
        progressAnim.setValue(dx);
      },
      onPanResponderRelease: () => {
        const current = lastOffsetRef.current;
        if (current >= threshold) {
          onConfirm();
          progressAnim.setValue(0);
          lastOffsetRef.current = 0;
        } else {
          Animated.spring(progressAnim, {
            toValue: 0,
            useNativeDriver: true,
            speed: 28,
            bounciness: 6,
          }).start();
          lastOffsetRef.current = 0;
        }
      },
    })
  ).current;

  return (
    <View style={{ width, height: CTA_HEIGHT, padding: CTA_INTERNAL_PADDING, justifyContent: 'center' }}>
      <View
        style={{
          width: trackWidth,
          height: trackHeight,
          borderRadius: BORDER_RADIUS,
          backgroundColor: palette.cardSurface,
          borderWidth: 1,
          borderColor: palette.activeHighlight,
          justifyContent: 'center',
          overflow: 'hidden',
          ...PRECISION_SHADOW,
        }}
      >
        {/* Subtle progress fill (very low opacity), no thumb; fill grows left-to-right via scaleX */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: trackWidth,
            backgroundColor: palette.primaryText,
            opacity: PROGRESS_FILL_OPACITY,
            borderRadius: BORDER_RADIUS,
            transform: [
              { translateX: progressAnim.interpolate({ inputRange: [0, maxDrag], outputRange: [trackWidth / 2, 0] }) },
              { scaleX: progressAnim.interpolate({ inputRange: [0, maxDrag], outputRange: [0, 1] }) },
            ],
          }}
        />
        <Text
          style={{
            position: 'absolute',
            width: '100%',
            textAlign: 'center',
            fontSize: 12,
            fontWeight: '700',
            color: palette.secondaryText,
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Text>
        {/* Invisible full-width drag handle */}
        <Animated.View
          style={StyleSheet.absoluteFill}
          {...panResponder.panHandlers}
        />
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const [data, setData] = useState<HomeTodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [weatherDropdownOpen, setWeatherDropdownOpen] = useState(false);
  const [sliderTrackWidth, setSliderTrackWidth] = useState(0);

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const containerWidth = screenWidth - HORIZONTAL_PADDING * 2;
  const sliderWidth = sliderTrackWidth > 0 ? sliderTrackWidth : containerWidth;
  const avatarWidth = Math.min(screenWidth * AVATAR_WIDTH_PCT, AVATAR_WIDTH_MAX);
  const avatarHeightRaw = Math.round(screenHeight * AVATAR_HEIGHT_PCT);
  const avatarHeight = Math.max(AVATAR_HEIGHT_MIN, Math.min(AVATAR_HEIGHT_MAX, avatarHeightRaw));
  const bottomPadding = BOTTOM_TAB_RESERVE + (insets?.bottom ?? 0);
  const infoCardW = (containerWidth - GRID_GAP * 2) / 3;

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
    } catch {
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
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

  const closeWeatherOverlay = useCallback(() => {
    setWeatherDropdownOpen(false);
  }, []);

  const toggleWeatherDropdown = useCallback(() => {
    setWeatherDropdownOpen((prev) => !prev);
  }, []);

  const goToCalendar = useCallback(() => {
    try {
      (navigation as { navigate: (name: string) => void }).navigate('Calendar');
    } catch {
      // Safe no-op if Calendar not on stack.
    }
  }, [navigation]);

  const goToOutfits = useCallback(() => {
    try {
      (navigation as { navigate: (name: string) => void }).navigate('Outfits');
    } catch {
      // TODO: When we remove Outfits tab (Option A), change destination here.
    }
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
          <ActivityIndicator size="large" color={HOME_PALETTE.primaryText} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const weather = data?.weather;
  const todayTemp = weather?.ok && weather.tempF != null ? Math.round(weather.tempF) : 70;
  const todayCondition = weather?.ok && weather.condition ? weather.condition : 'Clouds';
  const todayDateStr = data?.date ? formatTodayLabel(data.date) : 'Today';

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: HOME_PALETTE.background }}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: HORIZONTAL_PADDING, paddingBottom: bottomPadding }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[HOME_PALETTE.primaryText]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header: exactly 60px height, serif HOME ~48px, letterSpacing -1, icons gap 16px */}
        <View style={[styles.headerRow, { height: HEADER_HEIGHT }]}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>HOME</Text>
          </View>
          <View style={styles.headerRight}>
            <HeaderIconButton onPress={toggleWeatherDropdown} icon="partly-sunny-outline" palette={HOME_PALETTE} style={styles.headerIconGap} />
            <HeaderIconButton onPress={goToCalendar} icon="calendar-outline" palette={HOME_PALETTE} style={styles.headerIconGap} />
            <HeaderIconButton onPress={goToOutfits} icon="add" palette={HOME_PALETTE} />
          </View>
        </View>

        {/* Compact error (only when API fails) */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText} numberOfLines={1}>{error}</Text>
            <Pressable style={styles.errorBannerRetry} onPress={() => { setLoading(true); loadHomeToday(); }}>
              <Text style={styles.errorBannerRetryText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {/* Avatar: portrait card, 78% width (max 340), 44% height (clamp 320–440), centered */}
        <View style={[styles.avatarArea, { height: avatarHeight }]}>
          <View style={[styles.avatarPlaceholder, { width: avatarWidth, height: avatarHeight }]}>
            <Ionicons name="person" size={Math.min(72, avatarWidth * 0.2)} color={HOME_PALETTE.secondaryText} />
          </View>
        </View>

        {/* CTA: no visible thumb; full-width invisible drag; subtle progress fill; 55% completes */}
        <View
          style={styles.sliderSection}
          onLayout={(e) => { const w = e.nativeEvent.layout.width; if (w > 0) setSliderTrackWidth(w); }}
        >
          <DragToConfirmSlider label="PLAN MY OUTFIT OF THE DAY" onConfirm={goToOutfits} palette={HOME_PALETTE} width={sliderWidth} />
        </View>

        {/* Info grid + bottom fade into tab bar */}
        <View style={styles.infoGridWrapper}>
          <View style={styles.infoGridRow}>
          <InfoCard palette={HOME_PALETTE} width={infoCardW}>
            <Ionicons name="partly-sunny-outline" size={20} color={HOME_PALETTE.primaryText} />
            <Text style={styles.infoCardValue}>{todayTemp}°F</Text>
            <Text style={styles.infoCardLabel} numberOfLines={1}>{todayCondition}</Text>
            <Text style={styles.infoCardMeta}>{todayDateStr}</Text>
          </InfoCard>
          <InfoCard palette={HOME_PALETTE} width={infoCardW}>
            <Text style={styles.infoCardTitle}>IN LAUNDRY</Text>
            <Text style={styles.infoCardValue}>0</Text>
            <Text style={styles.infoCardMeta}>items</Text>
          </InfoCard>
          <InfoCard palette={HOME_PALETTE} width={infoCardW}>
            <Text style={styles.infoCardTitle}>Fashion Fact</Text>
            <Text style={styles.infoCardFact}>Neutral tones pair with any accent.</Text>
          </InfoCard>
          </View>
          {/* Subtle bottom fade so content blends into tab bar (does not overlap tab bar) */}
          <View style={styles.bottomFade} />
        </View>
      </ScrollView>

      {/* Weather overlay: absolute, anchor under header right, tap outside closes */}
      {weatherDropdownOpen && (
        <>
          <Pressable style={[StyleSheet.absoluteFill, styles.overlayBackdrop]} onPress={closeWeatherOverlay} accessibilityRole="button" accessibilityLabel="Close weather" />
          <View style={[styles.weatherOverlay, { top: HEADER_HEIGHT, right: HORIZONTAL_PADDING }]} pointerEvents="box-none">
            <View style={styles.weatherDropdown}>
              <View style={styles.weatherDropdownHeader}>
                <Text style={styles.weatherDropdownTitle}>Next 7 days</Text>
                <Pressable onPress={closeWeatherOverlay} hitSlop={12} style={{ padding: 4 }}>
                  <Ionicons name="close" size={18} color={HOME_PALETTE.secondaryText} />
                </Pressable>
              </View>
              {MOCK_7_DAY_FORECAST.map((row, idx) => (
                <View key={`${row.day}-${idx}`} style={styles.weatherDropdownRow}>
                  <Text style={styles.weatherDropdownDay}>{row.day}</Text>
                  <Ionicons name={row.icon as keyof typeof Ionicons.glyphMap} size={20} color={HOME_PALETTE.secondaryText} />
                  <Text style={styles.weatherDropdownTemp}>{row.temp}°F</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  const p = HOME_PALETTE;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },
    scrollContent: { flexGrow: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: HORIZONTAL_PADDING },
    title: { fontSize: 18, color: p.secondaryText },
    loadingText: { marginTop: 12, fontSize: 14, color: p.secondaryText },

    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerTitle: {
      fontFamily: SERIF_FONT,
      fontSize: 48,
      fontWeight: '700',
      color: p.primaryText,
      letterSpacing: -1,
    },
    headerRight: { flexDirection: 'row', alignItems: 'center' },
    headerIconGap: { marginRight: 16 },

    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: p.cardSurface,
      borderWidth: 1,
      borderColor: p.activeHighlight,
      borderRadius: BORDER_RADIUS,
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: 12,
      ...PRECISION_SHADOW,
    },
    errorBannerText: { flex: 1, fontSize: 14, color: p.primaryText, marginRight: 8 },
    errorBannerRetry: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: p.activeHighlight, borderRadius: BORDER_RADIUS },
    errorBannerRetryText: { fontSize: 12, fontWeight: '600', color: p.primaryText },

    avatarArea: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
      width: '100%',
    },
    avatarPlaceholder: {
      borderRadius: BORDER_RADIUS,
      backgroundColor: p.cardSurface,
      borderWidth: 1,
      borderColor: p.activeHighlight,
      justifyContent: 'center',
      alignItems: 'center',
      ...PRECISION_SHADOW,
    },

    sliderSection: { marginBottom: 12, width: '100%' },

    infoGridWrapper: { width: '100%' },
    infoGridRow: {
      flexDirection: 'row',
      gap: GRID_GAP,
    },
    bottomFade: {
      height: 32,
      backgroundColor: p.bottomBarSurface,
      marginTop: 8,
      borderTopLeftRadius: BORDER_RADIUS,
      borderTopRightRadius: BORDER_RADIUS,
    },
    infoCardTitle: { fontSize: 11, fontWeight: '700', color: p.secondaryText, letterSpacing: 0.5, marginBottom: 4 },
    infoCardValue: { fontSize: 18, fontWeight: '700', color: p.primaryText, marginTop: 4 },
    infoCardLabel: { fontSize: 12, color: p.secondaryText, marginTop: 2 },
    infoCardMeta: { fontSize: 11, color: p.secondaryText, marginTop: 2 },
    infoCardFact: { fontSize: 11, color: p.secondaryText, marginTop: 2 },

    overlayBackdrop: { backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 100, elevation: 100 },
    weatherOverlay: { position: 'absolute', zIndex: 101, elevation: 101, minWidth: 260, maxWidth: 320 },
    weatherDropdown: {
      backgroundColor: p.cardSurface,
      borderRadius: BORDER_RADIUS,
      borderWidth: 1,
      borderColor: p.activeHighlight,
      overflow: 'hidden',
      ...PRECISION_SHADOW,
    },
    weatherDropdownHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: p.activeHighlight,
    },
    weatherDropdownTitle: { fontSize: 16, fontWeight: '600', color: p.primaryText },
    weatherDropdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p.activeHighlight,
    },
    weatherDropdownDay: { fontSize: 14, color: p.primaryText, minWidth: 48 },
    weatherDropdownTemp: { fontSize: 14, fontWeight: '600', color: p.primaryText },
  });
}

/*
VERIFICATION
===========
- Only src/screens/HomeScreen.tsx changed. Run: npx expo start -c --tunnel
- Avatar: portrait card, 78% width (max 340), 44% height (320–440), centered; less empty space.
- Slider: no visible thumb; track + text only; full-width invisible drag; subtle progress fill; 55% completes in one swipe; spring back if released early.
- Layout: tightened gaps (header–avatar, avatar–slider); bottom fade blends into tab bar; no extra top margins.
- Works on iPhone SE and Pro Max; no new deps; no TS/runtime errors.
*/
