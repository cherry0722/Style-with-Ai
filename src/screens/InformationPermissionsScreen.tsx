/**
 * Information & Permissions Screen
 * Shows live permission status for Camera, Photo Library, Location, and Notifications.
 * Tapping a permission:
 *   - DENIED / BLOCKED → opens iOS Settings app for this app
 *   - NOT ASKED (UNDETERMINED) → triggers the system permission request dialog
 *   - GRANTED → opens iOS Settings (user can revoke there)
 * Refreshes status every time the screen comes into focus (handles user returning from Settings).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  check,
  request,
  openSettings,
  PERMISSIONS,
  RESULTS,
  Permission,
} from 'react-native-permissions';

// ─── Palette (matches app-wide theme) ────────────────────────────────────────
const P = {
  background:    '#F5F0E8',
  cardSurface:   '#EDE6D8',
  cardWhite:     '#FFFFFF',
  primaryText:   '#3D3426',
  secondaryText: '#8C7E6A',
  lightText:     '#B5A894',
  accent:        '#C4A882',
  border:        '#E8E0D0',
  danger:        '#C8706A',
  success:       '#4C8C61',
  warning:       '#C49A3C',
} as const;

// ─── Permission config ────────────────────────────────────────────────────────
type PermKey = 'camera' | 'photos' | 'location' | 'notifications';
type PermStatus = 'granted' | 'denied' | 'blocked' | 'unavailable' | 'limited' | 'loading';

interface PermConfig {
  key: PermKey;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  iosPermission: Permission;
}

const PERMISSION_CONFIG: PermConfig[] = [
  {
    key: 'camera',
    label: 'Camera',
    description: 'Used to photograph clothing items for your closet.',
    icon: 'camera-outline',
    iosPermission: PERMISSIONS.IOS.CAMERA,
  },
  {
    key: 'photos',
    label: 'Photo Library',
    description: 'Used to import clothing photos from your library.',
    icon: 'images-outline',
    iosPermission: PERMISSIONS.IOS.PHOTO_LIBRARY,
  },
  {
    key: 'location',
    label: 'Location',
    description: 'Used to show local weather for outfit suggestions.',
    icon: 'location-outline',
    iosPermission: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
  },
  {
    key: 'notifications',
    label: 'Notifications',
    description: 'Used to send outfit reminders and updates.',
    icon: 'notifications-outline',
    iosPermission: PERMISSIONS.IOS.NOTIFICATION,
  },
];

// ─── Status helpers ───────────────────────────────────────────────────────────
function mapResult(result: string): PermStatus {
  switch (result) {
    case RESULTS.GRANTED:   return 'granted';
    case RESULTS.LIMITED:   return 'limited';
    case RESULTS.DENIED:    return 'denied';
    case RESULTS.BLOCKED:   return 'blocked';
    case RESULTS.UNAVAILABLE: return 'unavailable';
    default:                return 'denied';
  }
}

function StatusBadge({ status }: { status: PermStatus }) {
  if (status === 'loading') {
    return <ActivityIndicator size="small" color={P.accent} />;
  }

  const config = {
    granted:     { label: 'Allowed',     color: P.success,  bg: `${P.success}15`  },
    limited:     { label: 'Limited',     color: P.warning,  bg: `${P.warning}15`  },
    denied:      { label: 'Not Asked',   color: P.warning,  bg: `${P.warning}15`  },
    blocked:     { label: 'Denied',      color: P.danger,   bg: `${P.danger}15`   },
    unavailable: { label: 'Unavailable', color: P.lightText, bg: `${P.lightText}15` },
  }[status] ?? { label: 'Unknown', color: P.lightText, bg: `${P.lightText}15` };

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

// ─── Permission Row ───────────────────────────────────────────────────────────
function PermissionRow({
  config,
  status,
  onPress,
  last,
}: {
  config: PermConfig;
  status: PermStatus;
  onPress: () => void;
  last?: boolean;
}) {
  const isUnavailable = status === 'unavailable';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        !last && styles.rowBorder,
        pressed && !isUnavailable && { opacity: 0.72 },
      ]}
      onPress={isUnavailable ? undefined : onPress}
      disabled={isUnavailable || status === 'loading'}
    >
      <View style={styles.rowIconWrap}>
        <Ionicons name={config.icon} size={20} color={P.accent} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{config.label}</Text>
        <Text style={styles.rowDescription}>{config.description}</Text>
      </View>
      <View style={styles.rowRight}>
        <StatusBadge status={status} />
        {!isUnavailable && status !== 'loading' && (
          <Ionicons
            name="chevron-forward"
            size={14}
            color={P.lightText}
            style={{ marginTop: 4 }}
          />
        )}
      </View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function InformationPermissionsScreen() {
  const navigation = useNavigation();
  const [statuses, setStatuses] = useState<Record<PermKey, PermStatus>>({
    camera:        'loading',
    photos:        'loading',
    location:      'loading',
    notifications: 'loading',
  });

  // ── Load all permission statuses ──────────────────────────────────────────
  const loadStatuses = useCallback(async () => {
    const results = await Promise.all(
      PERMISSION_CONFIG.map(async (cfg) => {
        try {
          const result = await check(cfg.iosPermission);
          return { key: cfg.key, status: mapResult(result) };
        } catch (_) {
          return { key: cfg.key, status: 'unavailable' as PermStatus };
        }
      })
    );
    const next = {} as Record<PermKey, PermStatus>;
    results.forEach(({ key, status }) => { next[key] = status; });
    setStatuses(next);
  }, []);

  // Load on mount
  useEffect(() => { void loadStatuses(); }, [loadStatuses]);

  // Reload every time screen comes back into focus (e.g. returning from Settings)
  useFocusEffect(
    useCallback(() => {
      void loadStatuses();
    }, [loadStatuses])
  );

  // ── Handle tap on a permission row ────────────────────────────────────────
  const handlePress = async (cfg: PermConfig) => {
    const current = statuses[cfg.key];

    if (current === 'granted' || current === 'limited' || current === 'blocked') {
      // Already granted or blocked → open Settings so user can change
      await openSettings().catch(() => {
        Linking.openURL('app-settings:').catch(() => {});
      });
      return;
    }

    if (current === 'denied') {
      // Not asked yet → request the permission
      try {
        const result = await request(cfg.iosPermission);
        setStatuses((prev) => ({ ...prev, [cfg.key]: mapResult(result) }));
      } catch (_) {
        // If request fails, try opening settings
        await openSettings().catch(() => {});
      }
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={P.primaryText} />
          </Pressable>
          <Text style={styles.pageTitle}>PERMISSIONS</Text>
        </View>

        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle-outline" size={18} color={P.accent} />
          <Text style={styles.infoText}>
            Tap a permission to allow or deny it. You'll be taken to iOS Settings where you can manage access for MYRA.
          </Text>
        </View>

        {/* Permissions card */}
        <SectionHeader title="App Permissions" />
        <View style={styles.card}>
          {PERMISSION_CONFIG.map((cfg, idx) => (
            <PermissionRow
              key={cfg.key}
              config={cfg}
              status={statuses[cfg.key]}
              onPress={() => void handlePress(cfg)}
              last={idx === PERMISSION_CONFIG.length - 1}
            />
          ))}
        </View>

        {/* Legend */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>Status Guide</Text>
          <LegendRow color={P.success}   label="Allowed"     desc="MYRA can access this." />
          <LegendRow color={P.warning}   label="Not Asked"   desc="Tap to request access." />
          <LegendRow color={P.warning}   label="Limited"     desc="Partial access granted." />
          <LegendRow color={P.danger}    label="Denied"      desc="Tap to open Settings and allow." />
          <LegendRow color={P.lightText} label="Unavailable" desc="Not available on this device." />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Legend row ───────────────────────────────────────────────────────────────
function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function LegendRow({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendDesc}>{desc}</Text>
    </View>
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

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: `${P.accent}12`,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${P.accent}30`,
    padding: 14,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: P.secondaryText,
    lineHeight: 19,
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
    shadowColor: 'rgba(61, 52, 38, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: P.border },
  rowIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: `${P.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowBody:        { flex: 1 },
  rowLabel:       { fontSize: 15, fontWeight: '600', color: P.primaryText },
  rowDescription: { fontSize: 12, color: P.secondaryText, marginTop: 2, lineHeight: 16 },
  rowRight:       { alignItems: 'flex-end', gap: 2 },

  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  legendCard: {
    backgroundColor: P.cardWhite,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: P.border,
    padding: 16,
    gap: 10,
  },
  legendTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: P.secondaryText,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: P.primaryText,
    width: 90,
  },
  legendDesc: {
    fontSize: 12,
    color: P.secondaryText,
    flex: 1,
  },
});