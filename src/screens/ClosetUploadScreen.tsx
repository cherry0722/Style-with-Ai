/**
 * ClosetUploadScreen — front/back image capture + clothing type selection
 * Milestone: closet-upload-front-back
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  ActionSheetIOS,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { uploadWardrobeItemFrontBack } from '../api/wardrobe';

const CLOTHING_TYPES = ['shirt', 'tshirt', 'hoodie', 'pant'] as const;
type ClothingType = (typeof CLOTHING_TYPES)[number];

const TYPE_LABELS: Record<ClothingType, string> = {
  shirt:  'Shirt',
  tshirt: 'T-Shirt',
  hoodie: 'Hoodie',
  pant:   'Pant',
};

async function pickFromCamera(
  onPicked: (uri: string) => void,
): Promise<void> {
  try {
    const r = await launchCamera({ mediaType: 'photo', quality: 0.9 });
    if (r.errorCode === 'camera_unavailable') {
      Alert.alert('Error', 'Camera is unavailable on this device.');
      return;
    }
    if (!r.didCancel && !r.errorCode && r.assets?.[0]?.uri) {
      onPicked(r.assets[0].uri);
    }
  } catch {
    Alert.alert('Error', 'Failed to open camera.');
  }
}

async function pickFromLibrary(
  onPicked: (uri: string) => void,
): Promise<void> {
  try {
    const r = await launchImageLibrary({ mediaType: 'photo', quality: 0.9 });
    if (!r.didCancel && !r.errorCode && r.assets?.[0]?.uri) {
      onPicked(r.assets[0].uri);
    }
  } catch {
    Alert.alert('Error', 'Failed to open library.');
  }
}

function showImageSourceSheet(onPicked: (uri: string) => void): void {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Take photo', 'Choose from library'],
        cancelButtonIndex: 0,
      },
      (i) => {
        if (i === 1) void pickFromCamera(onPicked);
        else if (i === 2) void pickFromLibrary(onPicked);
      },
    );
  } else {
    Alert.alert('Choose source', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Take photo',          onPress: () => void pickFromCamera(onPicked) },
      { text: 'Choose from library', onPress: () => void pickFromLibrary(onPicked) },
    ]);
  }
}

interface ImageSlotProps {
  label: string;
  uri: string | null;
  onSelect: () => void;
  onRetake: () => void;
}

function ImageSlot({ label, uri, onSelect, onRetake }: Readonly<ImageSlotProps>) {
  const { colors } = useTheme();
  return (
    <View style={[slotStyles.container, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
      <Text style={[slotStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      {uri ? (
        <>
          <Image source={{ uri }} style={slotStyles.preview} resizeMode="contain" />
          <Pressable
            style={[slotStyles.retakeBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
            onPress={onRetake}
          >
            <Ionicons name="refresh-outline" size={14} color={colors.textSecondary} />
            <Text style={[slotStyles.retakeText, { color: colors.textSecondary }]}>Retake</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          style={[slotStyles.addBtn, { backgroundColor: colors.accent + '18' }]}
          onPress={onSelect}
          accessibilityRole="button"
          accessibilityLabel={`Add ${label} photo`}
        >
          <Ionicons name="camera-outline" size={28} color={colors.accent} />
          <Text style={[slotStyles.addText, { color: colors.accent }]}>Add photo</Text>
        </Pressable>
      )}
    </View>
  );
}

const slotStyles = StyleSheet.create({
  container: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    aspectRatio: 3 / 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    top: 10,
    left: 12,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    zIndex: 1,
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  retakeBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  retakeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  addBtn: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default function ClosetUploadScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();

  const [frontUri, setFrontUri] = useState<string | null>(null);
  const [backUri,  setBackUri]  = useState<string | null>(null);
  const [clothingType, setClothingType] = useState<ClothingType | null>(null);
  const [uploading, setUploading] = useState(false);

  const selectFront  = useCallback(() => showImageSourceSheet(setFrontUri), []);
  const selectBack   = useCallback(() => showImageSourceSheet(setBackUri),  []);

  const handleUpload = useCallback(async () => {
    if (!frontUri) {
      Alert.alert('Missing image', 'Please add a front photo.');
      return;
    }
    if (!backUri) {
      Alert.alert('Missing image', 'Please add a back photo.');
      return;
    }
    if (!clothingType) {
      Alert.alert('Missing type', 'Please select a clothing type.');
      return;
    }

    setUploading(true);
    try {
      await uploadWardrobeItemFrontBack(frontUri, backUri, clothingType);
      Alert.alert('Added to closet', 'Your item is being processed.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Please try again.';
      Alert.alert('Upload failed', msg);
    } finally {
      setUploading(false);
    }
  }, [frontUri, backUri, clothingType, navigation]);

  const canUpload = !!frontUri && !!backUri && !!clothingType && !uploading;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Add Item</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Image slots */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PHOTOS</Text>
        <View style={styles.slotsRow}>
          <ImageSlot
            label="Front"
            uri={frontUri}
            onSelect={selectFront}
            onRetake={selectFront}
          />
          <View style={styles.slotGap} />
          <ImageSlot
            label="Back"
            uri={backUri}
            onSelect={selectBack}
            onRetake={selectBack}
          />
        </View>

        {/* Clothing type */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>CLOTHING TYPE</Text>
        <View style={styles.typeRow}>
          {CLOTHING_TYPES.map((t) => {
            const selected = clothingType === t;
            return (
              <Pressable
                key={t}
                style={[
                  styles.typeChip,
                  {
                    backgroundColor: selected ? colors.accent : colors.backgroundSecondary,
                    borderColor:     selected ? colors.accent : colors.border,
                  },
                ]}
                onPress={() => setClothingType(t)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={TYPE_LABELS[t]}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    { color: selected ? '#FFFFFF' : colors.text },
                  ]}
                >
                  {TYPE_LABELS[t]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.comingSoonNote, { color: colors.textSecondary }]}>
          Shoes, dresses &amp; accessories coming soon
        </Text>
      </ScrollView>

      {/* Upload button */}
      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable
          style={[
            styles.uploadBtn,
            { backgroundColor: canUpload ? colors.accent : colors.border },
          ]}
          onPress={handleUpload}
          disabled={!canUpload}
          accessibilityRole="button"
          accessibilityLabel="Upload item"
        >
          {uploading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.uploadBtnText}>Upload Item</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  content: {
    padding: 20,
    paddingBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },
  slotsRow: {
    flexDirection: 'row',
    marginBottom: 28,
  },
  slotGap: {
    width: 12,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
  },
  typeChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  comingSoonNote: {
    marginTop: 14,
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  footer: {
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  uploadBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
