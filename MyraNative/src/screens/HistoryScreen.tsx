import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getOutfits, type OutfitHistoryItem } from '../api/outfits';

function formatDate(createdAt: string | undefined): string {
  if (!createdAt) return '—';
  try {
    const d = new Date(createdAt);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '—';
  }
}

export default function HistoryScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [outfits, setOutfits] = useState<OutfitHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getOutfits(50);
      setOutfits(data.outfits || []);
    } catch (err) {
      if (__DEV__) {
        console.warn('[HistoryScreen] Failed to load outfits', err);
      }
      setOutfits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const firstReason = (item: OutfitHistoryItem): string | null => {
    const reasons = item.reasons;
    if (Array.isArray(reasons) && reasons.length > 0 && typeof reasons[0] === 'string') {
      return reasons[0];
    }
    return null;
  };

  const styles = createStyles(theme);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  if (loading && outfits.length === 0) {
    return (
      <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <Pressable style={styles.headerBack} onPress={goBack}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>History</Text>
            <Text style={styles.subtitle}>Outfit history</Text>
          </View>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Pressable style={styles.headerBack} onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>History</Text>
          <Text style={styles.subtitle}>Outfit history</Text>
        </View>
      </View>

      {outfits.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="shirt-outline" size={56} color={theme.colors.textTertiary} />
          <Text style={styles.emptyText}>No outfit history yet</Text>
        </View>
      ) : (
        <FlatList
          data={outfits}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={theme.colors.accent}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowDate}>{formatDate(item.createdAt)}</Text>
                <Text style={styles.rowOccasion}>{item.occasion || '—'}</Text>
                <Text style={styles.rowMeta}>
                  engine: {item.engine ?? '—'} · python: {item.pythonUsed ? 'yes' : 'no'}
                </Text>
                {firstReason(item) ? (
                  <Text style={styles.rowReason} numberOfLines={2}>
                    {firstReason(item)}
                  </Text>
                ) : null}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerBack: { padding: theme.spacing.sm, marginRight: theme.spacing.xs },
    headerCenter: { flex: 1 },
    title: {
      fontSize: theme.typography['2xl'],
      fontWeight: theme.typography.bold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    subtitle: {
      fontSize: theme.typography.base,
      color: theme.colors.textSecondary,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listContent: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
    },
    row: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      ...theme.shadows.sm,
    },
    rowLeft: {
      flex: 1,
    },
    rowDate: {
      fontSize: theme.typography.sm,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xs,
    },
    rowOccasion: {
      fontSize: theme.typography.base,
      fontWeight: theme.typography.medium,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    rowMeta: {
      fontSize: theme.typography.xs,
      color: theme.colors.textTertiary,
      marginBottom: theme.spacing.xs,
    },
    rowReason: {
      fontSize: theme.typography.sm,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
    },
    empty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: theme.spacing['2xl'],
    },
    emptyText: {
      fontSize: theme.typography.lg,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.md,
    },
  });
}
