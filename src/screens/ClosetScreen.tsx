/**
 * Closet Screen (v1) — Add Item (POST /api/wardrobe/items), list from GET /api/wardrobe.
 */
import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  ActionSheetIOS,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useIsFocused } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { listWardrobe, uploadWardrobeItem, WardrobeItemV1Response, WardrobeItemResponse } from '../api/wardrobe';

export default function ClosetScreen() {
  const theme = useTheme();
  const { user, token } = useAuth();
  const isFocused = useIsFocused();
  const [items, setItems] = useState<WardrobeItemResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<'idle' | 'uploading' | 'removing' | 'saving'>('idle');
  const [lastUploaded, setLastUploaded] = useState<WardrobeItemV1Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);

  const loadWardrobe = useCallback(async () => {
    if (!user || !token) {
      setItems([]);
      return;
    }
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      setLoading(true);
      setError(null);
      const data = await listWardrobe();
      setItems(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load wardrobe.');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [user, token]);

  useEffect(() => {
    if (!user || !token) {
      setItems([]);
      return;
    }
    if (isFocused) loadWardrobe();
  }, [isFocused, user, token, loadWardrobe]);

  const pickAndUpload = useCallback(async () => {
    if (!user) return;
    const options = ['Cancel', 'Take photo', 'Choose from library'];
    const run = (source: 'camera' | 'library') => {
      (source === 'camera' ? pickFromCamera() : pickFromLibrary()).then((uri) => {
        if (uri) doUpload(uri);
      });
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 0 }, (i) => {
        if (i === 1) run('camera');
        else if (i === 2) run('library');
      });
    } else {
      Alert.alert('Add Item', 'Choose source', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Take photo', onPress: () => run('camera') },
        { text: 'Choose from library', onPress: () => run('library') },
      ]);
    }
  }, [user]);

  const pickFromCamera = async (): Promise<string | null> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission', 'Camera permission is needed.');
      return null;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    return result.canceled || !result.assets?.length ? null : result.assets[0].uri;
  };

  const pickFromLibrary = async (): Promise<string | null> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission', 'Library access is needed.');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    return result.canceled || !result.assets?.length ? null : result.assets[0].uri;
  };

  const doUpload = async (uri: string) => {
    try {
      setUploading(true);
      setError(null);
      setUploadStep('uploading');
      const item = await uploadWardrobeItem(uri);
      setUploadStep('saving');
      setLastUploaded(item);
      await loadWardrobe();
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      const msg = err?.message || 'Upload failed. Please try again.';
      const friendly =
        status === 502 || status === 500
          ? 'Service temporarily unavailable. Please try again later.'
          : status === 401
            ? 'Session expired. Please log in again.'
            : msg;
      setError(friendly);
      Alert.alert('Upload failed', friendly);
    } finally {
      setUploading(false);
      setUploadStep('idle');
    }
  };

  const styles = createStyles(theme);

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.title}>Sign in to see your closet</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.addButton} onPress={pickAndUpload} disabled={uploading}>
          {uploading ? (
            <>
              <ActivityIndicator size="small" color={theme.colors.accent} />
              <Text style={styles.addButtonText}>
                {uploadStep === 'uploading' ? 'Uploading…' : 'Saving…'}
              </Text>
            </>
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={24} color={theme.colors.accent} />
              <Text style={styles.addButtonText}>Add Item</Text>
            </>
          )}
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {lastUploaded && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Last added</Text>
            <View style={styles.heroImageWrap}>
              <Image
                source={{ uri: lastUploaded.cleanImageUrl || lastUploaded.imageUrl }}
                style={styles.heroImage}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.resultMeta}>
              {lastUploaded.profile?.category || lastUploaded.category || '—'} / {lastUploaded.profile?.type || lastUploaded.type || '—'}
            </Text>
            {lastUploaded.profile?.confidence != null && (
              <Text style={styles.confidence}>Confidence: {lastUploaded.profile.confidence}%</Text>
            )}
          </View>
        )}

        {loading && items.length === 0 ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text style={styles.loadingText}>Loading wardrobe...</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="shirt-outline" size={48} color={theme.colors.textTertiary} />
            <Text style={styles.emptyText}>Add your first item</Text>
            <Pressable style={styles.emptyButton} onPress={pickAndUpload} disabled={uploading}>
              <Ionicons name="add-circle-outline" size={22} color={theme.colors.accent} />
              <Text style={styles.emptyButtonText}>Add your first item</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.listWrap}>
            <Text style={styles.sectionTitle}>Your wardrobe</Text>
            <FlatList
              data={items}
              keyExtractor={(i) => i._id}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={styles.row}
              renderItem={({ item }) => (
                <View style={styles.itemCard}>
                  <View style={styles.itemImageWrap}>
                    <Image
                      source={{ uri: item.cleanImageUrl || item.imageUrl }}
                      style={styles.itemImage}
                      resizeMode="cover"
                    />
                  </View>
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    {item.profile?.category ?? item.category ?? '—'}
                    {(item.profile?.type ?? item.type) ? ` · ${item.profile?.type ?? item.type}` : ''}
                  </Text>
                </View>
              )}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    scroll: { padding: theme.spacing.lg, paddingBottom: theme.spacing['2xl'] },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: theme.spacing.xl },
    title: { fontSize: theme.typography.lg, color: theme.colors.textSecondary },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.lg,
      marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    addButtonText: { fontSize: theme.typography.base, fontWeight: '600', color: theme.colors.accent },
    errorText: { fontSize: theme.typography.sm, color: theme.colors.error, marginBottom: theme.spacing.md },
    resultCard: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
    },
    resultTitle: { fontSize: theme.typography.sm, color: theme.colors.textSecondary, marginBottom: theme.spacing.sm },
    heroImageWrap: {
      width: '100%',
      height: 280,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.backgroundTertiary ?? theme.colors.background,
      marginBottom: theme.spacing.sm,
      overflow: 'hidden',
    },
    heroImage: { width: '100%', height: '100%' },
    resultMeta: { fontSize: theme.typography.sm, color: theme.colors.textPrimary },
    confidence: { fontSize: theme.typography.xs, color: theme.colors.textTertiary, marginTop: theme.spacing.xs },
    loading: { alignItems: 'center', paddingVertical: theme.spacing['2xl'] },
    loadingText: { marginTop: theme.spacing.md, fontSize: theme.typography.sm, color: theme.colors.textSecondary },
    empty: { alignItems: 'center', paddingVertical: theme.spacing['2xl'] },
    emptyText: { marginTop: theme.spacing.md, fontSize: theme.typography.base, color: theme.colors.textSecondary },
    emptyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
      backgroundColor: theme.colors.accent,
      borderRadius: theme.borderRadius.lg,
    },
    emptyButtonText: { fontSize: theme.typography.base, fontWeight: '600', color: theme.colors.white },
    listWrap: { marginTop: theme.spacing.sm },
    sectionTitle: { fontSize: theme.typography.base, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: theme.spacing.md },
    row: { gap: theme.spacing.md, marginBottom: theme.spacing.md },
    itemCard: { flex: 1, backgroundColor: theme.colors.backgroundSecondary, borderRadius: theme.borderRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border },
    itemImageWrap: {
      width: '100%',
      height: 220,
      backgroundColor: theme.colors.backgroundTertiary ?? theme.colors.background,
      overflow: 'hidden',
      borderTopLeftRadius: theme.borderRadius.lg - 1,
      borderTopRightRadius: theme.borderRadius.lg - 1,
    },
    itemImage: { width: '100%', height: '100%' },
    itemMeta: { fontSize: theme.typography.xs, color: theme.colors.textSecondary, padding: theme.spacing.sm },
  });
}
