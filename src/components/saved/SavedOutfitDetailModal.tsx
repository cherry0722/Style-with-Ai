/**
 * SavedOutfitDetailModal — read-only 3D avatar preview for a saved outfit.
 *
 * Renders a full Filament scene with the saved outfit applied to the avatar.
 * Reuses the same combined-avatar pipeline (resolveCombinedAvatar, EntitySelector
 * tinting) as Avatar3DScreen but in a standalone modal — no generation flow,
 * no planner integration.
 *
 * Config application strategy (differs from Avatar3DScreen to avoid a timing
 * race between Filament engine init and imperative setConfig):
 *   - config is derived in the parent and passed as a PROP to DetailSceneContent
 *   - when avatarRenderConfig is available, the config is correct from the first
 *     render — no imperative call needed, no mount-timing dependency
 *   - when avatarRenderConfig is absent, an async fetch resolves the config and
 *     updates parent state → prop change → scene re-renders with the new config
 *
 * Rotation uses the same imperative-handle pattern proven in Avatar3DScreen:
 *   - Rotation state lives inside DetailSceneContent (not the modal parent)
 *   - PanResponder calls sceneRef.setRotationY() imperatively
 *   - Zero outer re-renders during drag
 */

import React, {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  Camera,
  DefaultLight,
  EntitySelector,
  FilamentScene,
  FilamentView,
  Model,
} from 'react-native-filament';
import { SavedOutfitItem } from '../../api/saved';
import { fetchOutfitAvatarMappings } from '../../api/avatar';
import {
  AvatarRenderConfig,
  buildRenderConfig,
  COMBINED_NODE_BODY,
  COMBINED_NODE_BOTTOM,
  COMBINED_NODE_TOP,
  EMPTY_RENDER_CONFIG,
  MVP_SKIN_TONE_LINEAR,
  resolveCombinedAvatar,
} from '../../avatar/avatarClothingConfig';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const AVATAR_MODEL = require('../../../assets/models/avatar/avatar_base_male.glb');

const COMBINED_AVATAR_TRANSFORM = {
  rotateX: -Math.PI / 2,
  rotateY: 0,
  rotateZ: 0,
};

const BODY_MATERIAL_PARAMS = {
  index: 0,
  parameters: { baseColorFactor: MVP_SKIN_TONE_LINEAR },
} as const;

const ROTATION_SENSITIVITY = 0.4;

// ── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg:          '#F5F0E8',
  cardBg:      '#EFE7DA',
  border:      '#E8E0D0',
  title:       '#3D3426',
  secondary:   '#8C7E6A',
  accent:      '#C4A882',
  chevron:     '#B5A894',
  shadow:      'rgba(61, 52, 38, 0.12)',
  actionBg:    'rgba(61, 52, 38, 0.06)',
  highlight:   'rgba(196, 168, 130, 0.18)',
} as const;

// ── Error boundary for EntitySelector ───────────────────────────────────────
class TintBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) {
    if (__DEV__) {
      console.warn('[SavedDetail] Tint failed:', error.message);
    }
  }
  render() { return this.state.hasError ? null : this.props.children; }
}

// ── Static scene parts — memo'd to prevent IBL buffer crash ─────────────────
const StaticSceneParts = React.memo(function StaticSceneParts() {
  return (
    <>
      <Camera
        cameraPosition={[0, 0, 4.5]}
        cameraTarget={[0, 0, 0]}
        focalLengthInMillimeters={50}
      />
      <DefaultLight />
    </>
  );
});

// ── Imperative handle — rotation only ───────────────────────────────────────
interface DetailSceneHandle {
  setRotationY: (rad: number) => void;
  getRotationY: () => number;
}

// ── Scene content ───────────────────────────────────────────────────────────
// Config is received as a PROP (not via imperative handle) so it's available
// from the very first render — avoids the Filament-init timing race that
// occurs when setConfig is called imperatively during the same effect cycle
// as the scene mount.
//
// Rotation remains imperative (via ref handle) for zero-rerender drag perf.
const DetailSceneContent = React.forwardRef<
  DetailSceneHandle,
  { config: AvatarRenderConfig }
>(function DetailSceneContent({ config }, ref) {
  const [rotationY, setRotationY] = useState(0);
  const rotationYRef = useRef(0);

  const resolved = useMemo(() => resolveCombinedAvatar(config), [config]);
  const avatarSource = resolved?.asset ?? AVATAR_MODEL;
  const isUsingCombined = resolved != null;

  useEffect(() => {
    if (!__DEV__) return;
    const label = resolved?.debugName ?? 'avatar_base_male.glb';
    console.log(
      `[SavedDetail] Model: ${isUsingCombined ? 'COMBINED' : 'BASE'} → ${label}`,
    );
  }, [resolved, isUsingCombined]);

  const modelRotation = useMemo<[number, number, number]>(
    () =>
      isUsingCombined
        ? [
            COMBINED_AVATAR_TRANSFORM.rotateX,
            COMBINED_AVATAR_TRANSFORM.rotateY + rotationY,
            COMBINED_AVATAR_TRANSFORM.rotateZ,
          ]
        : [0, rotationY, 0],
    [isUsingCombined, rotationY],
  );

  const topMaterialParams = useMemo(
    () =>
      resolved
        ? { index: 0, parameters: { baseColorFactor: resolved.topColor } }
        : null,
    [resolved],
  );
  const bottomMaterialParams = useMemo(
    () =>
      resolved
        ? { index: 0, parameters: { baseColorFactor: resolved.bottomColor } }
        : null,
    [resolved],
  );

  useImperativeHandle(
    ref,
    () => ({
      setRotationY(rad) {
        rotationYRef.current = rad;
        setRotationY(rad);
      },
      getRotationY() {
        return rotationYRef.current;
      },
    }),
    [],
  );

  return (
    <FilamentView style={styles.filamentView}>
      <StaticSceneParts />
      <Model
        key={avatarSource}
        source={avatarSource}
        transformToUnitCube
        rotate={modelRotation}>
        {isUsingCombined && (
          <>
            <TintBoundary>
              <EntitySelector
                byName={COMBINED_NODE_BODY}
                materialParameters={BODY_MATERIAL_PARAMS}
              />
            </TintBoundary>
            {topMaterialParams && bottomMaterialParams && (
              <TintBoundary>
                <EntitySelector
                  byName={COMBINED_NODE_TOP}
                  materialParameters={topMaterialParams}
                />
                <EntitySelector
                  byName={COMBINED_NODE_BOTTOM}
                  materialParameters={bottomMaterialParams}
                />
              </TintBoundary>
            )}
          </>
        )}
      </Model>
    </FilamentView>
  );
});

// Memo boundary — only re-renders when config changes (ref is stable).
const DetailStage = React.memo(function DetailStage({
  sceneRef,
  config,
}: {
  sceneRef: React.RefObject<DetailSceneHandle | null>;
  config: AvatarRenderConfig;
}) {
  return (
    <FilamentScene>
      <DetailSceneContent ref={sceneRef} config={config} />
    </FilamentScene>
  );
});

// ── Main modal component ───────────────────────────────────────────────────
interface Props {
  visible: boolean;
  outfit: SavedOutfitItem | null;
  onClose: () => void;
}

export default function SavedOutfitDetailModal({
  visible,
  outfit,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const sceneRef = useRef<DetailSceneHandle>(null);
  const baseAtGestureStart = useRef(0);

  // Async-resolved config for outfits that lack a precomputed avatarRenderConfig.
  const [asyncConfig, setAsyncConfig] = useState<AvatarRenderConfig | null>(
    null,
  );

  // Config priority: precomputed on saved outfit → async-resolved → empty.
  // When avatarRenderConfig exists, this resolves synchronously on the first
  // render — the scene mounts with the correct model source immediately.
  const config: AvatarRenderConfig =
    outfit?.avatarRenderConfig ?? asyncConfig ?? EMPTY_RENDER_CONFIG;

  // Async fallback: fetch mappings when no precomputed config is available.
  // Reset rotation and async state when a new outfit is opened.
  useEffect(() => {
    if (!visible || !outfit) return;
    let cancelled = false;

    setAsyncConfig(null);
    sceneRef.current?.setRotationY(0);

    if (__DEV__) {
      console.log(
        `[SavedDetail] Opening outfit ${outfit._id} — ` +
          (outfit.avatarRenderConfig
            ? 'using precomputed avatarRenderConfig'
            : 'will fetch mappings'),
      );
    }

    if (!outfit.avatarRenderConfig) {
      (async () => {
        try {
          const mappings = await fetchOutfitAvatarMappings(outfit.items);
          if (cancelled) return;
          const built = buildRenderConfig(mappings);
          if (__DEV__) {
            console.log('[SavedDetail] Async config resolved:', {
              top: built.top?.assetFamily ?? null,
              bottom: built.bottom?.assetFamily ?? null,
            });
          }
          setAsyncConfig(built);
        } catch {
          if (__DEV__) console.warn('[SavedDetail] mapping failed');
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [visible, outfit]);

  // PanResponder — same pattern as Avatar3DScreen.
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderGrant: () => {
        baseAtGestureStart.current =
          sceneRef.current?.getRotationY() ?? 0;
      },
      onPanResponderMove: (_, gs) => {
        const nextY =
          baseAtGestureStart.current + gs.dx * ROTATION_SENSITIVITY;
        sceneRef.current?.setRotationY(nextY);
      },
    }),
  ).current;

  if (!outfit) return null;

  const itemLabels = outfit.items
    .map((i: any) => i.type ?? i.category ?? '')
    .filter(Boolean)
    .slice(0, 3)
    .join(' · ');

  const firstReason = outfit.reasons?.[0]?.trim() || null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close">
            <Ionicons name="close" size={20} color={C.title} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Saved Outfit</Text>
          <View style={styles.closeBtnSpacer} />
        </View>

        {/* 3D Stage */}
        <View style={styles.stageCard}>
          <View style={styles.avatarHighlight} />
          <View
            style={styles.sceneContainer}
            {...panResponder.panHandlers}>
            <DetailStage sceneRef={sceneRef} config={config} />
          </View>
        </View>

        {/* Metadata panel */}
        <View style={styles.metaPanel}>
          {outfit.occasion && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{outfit.occasion}</Text>
            </View>
          )}
          {itemLabels ? (
            <Text style={styles.itemLabels}>{itemLabels}</Text>
          ) : null}
          {firstReason && (
            <ScrollView
              style={styles.reasonScroll}
              bounces={false}
              showsVerticalScrollIndicator={false}>
              <Text style={styles.reasonText}>{firstReason}</Text>
            </ScrollView>
          )}
        </View>

        {/* Drag hint */}
        <Text
          style={[
            styles.hint,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}>
          Swipe on avatar to rotate
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // ── Header ────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.actionBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnSpacer: {
    width: 36,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: C.title,
    letterSpacing: 0.3,
  },

  // ── 3D Stage ──────────────────────────────────────────────────
  stageCard: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 6,
  },
  sceneContainer: {
    flex: 1,
  },
  filamentView: {
    flex: 1,
  },
  avatarHighlight: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: C.highlight,
    alignSelf: 'center',
    top: '50%',
    marginTop: -110,
    zIndex: 0,
  },

  // ── Metadata ──────────────────────────────────────────────────
  metaPanel: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#EDE6D8',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: 'rgba(196,168,130,0.4)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.accent,
    textTransform: 'capitalize',
    letterSpacing: 0.2,
  },
  itemLabels: {
    fontSize: 13,
    fontWeight: '500',
    color: C.title,
  },
  reasonScroll: {
    maxHeight: 80,
  },
  reasonText: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    color: C.secondary,
  },

  // ── Hint ──────────────────────────────────────────────────────
  hint: {
    textAlign: 'center',
    fontSize: 11,
    color: C.chevron,
  },
});
