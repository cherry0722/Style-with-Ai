/**
 * Avatar3DScreen — feature/avatar-glb-base
 *
 * Dedicated stage for the user's 3D avatar.
 * Layout: header → stage card (flex) → reserved bottom strip for future controls.
 *
 * Rendering architecture (required by react-native-filament):
 *
 *   FilamentScene   — initialises the Filament engine; provides
 *                     FilamentContext + RenderCallbackContext to children
 *     └─ SceneContent  — MUST be a separate child component so both contexts
 *                        are available when hooks inside Camera/Model run.
 *                        Owns rotationY state; exposes SceneHandle imperatively.
 *          └─ FilamentView   — the Metal surface
 *               ├─ StaticSceneParts  — React.memo'd: Camera + DefaultLight.
 *               │    Never re-renders during drag — prevents the
 *               │    "FilamentBuffer already released" crash in EnvironmentalLight.
 *               └─ Model  — combined dressed avatar or base naked avatar.
 *
 * Rotation isolation strategy (two layers):
 *   1. Avatar3DScreen holds NO rotation state. PanResponder calls
 *      sceneRef.current.setRotationY() imperatively → zero outer re-renders.
 *   2. StaticSceneParts is React.memo'd with no props → Camera and DefaultLight
 *      are never re-rendered even when SceneContent's rotationY state changes.
 *
 * Model path: assets/models/avatar/avatar_base_male.glb
 *   Metro resolves .glb via the assetExts entry in metro.config.js.
 */

import React, {useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {
  Camera,
  DefaultLight,
  EntitySelector,
  FilamentScene,
  FilamentView,
  Model,
} from 'react-native-filament';
import {getReasonedOutfits, ReasonedOutfitEntry} from '../api/ai';
import {fetchOutfitAvatarMappings} from '../api/avatar';
import { useRoute } from '@react-navigation/native';
import { useSavedOutfits } from '../store/savedOutfits';
import { CreateSavedOutfitPayload } from '../api/saved';
import {
  AvatarRenderConfig,
  buildRenderConfig,
  COMBINED_NODE_BODY,
  COMBINED_NODE_BOTTOM,
  COMBINED_NODE_TOP,
  EMPTY_RENDER_CONFIG,
  MVP_SKIN_TONE_LINEAR,
  resolveCombinedAvatar,
} from '../avatar/avatarClothingConfig';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const AVATAR_MODEL = require('../../assets/models/avatar/avatar_base_male.glb');

// ── Combined avatar axis-correction ───────────────────────────────────────────
// Combined dressed avatars exported from Blender use Z-up world space, but
// glTF / Filament expect Y-up.  This rotation offset stands the model upright.
// Applied only when a combined avatar is active (see isUsingCombined below).
//
// Values are RADIANS.  Application order: R_z · R_y · R_x · UnitCubeTransform.
const COMBINED_AVATAR_TRANSFORM = {
  rotateX: -Math.PI / 2,   // -90°: Z-up → Y-up
  rotateY: 0,
  rotateZ: 0,
};

// ── Body skin tone — combined avatar only ─────────────────────────────────────
// Stable module-level constant: no useMemo needed, never recreated.
// Applied to Male_body via EntitySelector when isUsingCombined is true.
// Source hex and linear value defined in avatarClothingConfig.ts (MVP_SKIN_TONE_*).
const BODY_MATERIAL_PARAMS = {
  index: 0,
  parameters: {baseColorFactor: MVP_SKIN_TONE_LINEAR},
} as const;

// ── Interaction constants ──────────────────────────────────────────────────────
const ROTATION_SENSITIVITY = 0.4;  // rad/px  (rotate prop is radians — see TransformProps.ts)

// NOTE: useApplyTransformations (react-native-filament internal) unconditionally
// re-applies transformToUnitCube on every effect run, resetting the matrix.
// But rotate is ONLY re-applied when areFloat3Equal(new, prev) returns false.
// If a new array reference is created with the same values, the effect re-runs
// (React sees the new reference), transformToUnitCube resets the matrix, but
// rotate is skipped → model snaps to the raw unit cube orientation.
// FIX: modelRotation is useMemo'd inside SceneContent so the array reference
// stays stable when the values don't change. See the CRITICAL comment there.

// ── Occasion options ───────────────────────────────────────────────────────────
const OCCASIONS = [
  {label: 'Casual',  value: 'casual'},
  {label: 'College', value: 'college'},
  {label: 'Party',   value: 'party'},
  {label: 'Date',    value: 'date'},
] as const;

// ── Error boundary for EntitySelector tinting ─────────────────────────────────
// EntitySelector throws during render if a GLB node name is not found.
// TintBoundary catches the throw so the avatar still renders — just untinted.
class TintBoundary extends React.Component<
  {children: React.ReactNode},
  {hasError: boolean}
> {
  state = {hasError: false};
  static getDerivedStateFromError() { return {hasError: true}; }
  componentDidCatch(error: Error) {
    if (__DEV__) {
      console.warn('[Avatar] Tint failed (entity name mismatch?):', error.message);
    }
  }
  render() { return this.state.hasError ? null : this.props.children; }
}

// ── Imperative handle exposed by SceneContent ─────────────────────────────────
// Methods reference only refs/stable setters → no stale closures.
export interface SceneHandle {
  setRotationY: (deg: number) => void;
  getRotationY: () => number;
  setClothingConfig: (config: AvatarRenderConfig) => void;
  getClothingConfig: () => AvatarRenderConfig;
}

// Camera and DefaultLight are completely static — same props forever.
// React.memo ensures they are NEVER re-rendered when rotationY changes,
// which prevents DefaultLight from re-initialising the IBL KTX buffer while
// the Filament render thread is still using it (the crash root cause).
const StaticSceneParts = React.memo(function StaticSceneParts() {
  return (
    <>
      {/*
       * Camera tuning — full-body framing.
       *
       * Key fact from RNFTransformManagerImpl.cpp:
       *   transformToUnitCube scales by 2.0 / maxExtent, so the model's
       *   dominant axis spans ±1 unit (2 units total), NOT ±0.5.
       *
       *   cameraPosition  [0, 0, 4.5]
       *     → horizontal half-width = 4.5 × (18/50) = 1.62 units
       *       → 0.62 units clearance around arms at ±1.0  (62% margin)
       *     → vertical half-height (aspect ≈ 0.85) = 1.91 units
       *       → 0.91 units clearance above head at +1.0  (91% margin)
       */}
      <Camera
        cameraPosition={[0, 0, 4.5]}
        cameraTarget={[0, 0, 0]}
        focalLengthInMillimeters={50}
      />
      <DefaultLight />
    </>
  );
});

// SceneContent owns rotationY state and exposes it imperatively.
// StaticSceneParts (Camera + DefaultLight) is memo-guarded — never re-renders.
// Only Model gets new rotate prop on each drag frame; no other prop changes.
const SceneContent = React.forwardRef<SceneHandle>(function SceneContent(_, ref) {
  const [rotationY, setRotationY] = useState(0);

  // Ref mirror so getRotationY() returns the live value before React flushes.
  const rotationYRef = useRef(0);

  // clothingConfig drives combined-avatar resolution via resolveCombinedAvatar().
  // useState (not useRef) so that pushing a new config via setClothingConfig()
  // triggers a re-render of SceneContent, causing the Model source to update.
  const [clothingConfig, setClothingConfigState] = useState<AvatarRenderConfig>(EMPTY_RENDER_CONFIG);
  const clothingConfigRef = useRef<AvatarRenderConfig>(EMPTY_RENDER_CONFIG);

  // ── Model source resolution ──────────────────────────────────────────────────
  // Uses the combined dressed avatar when the resolver matches the current
  // clothing config; otherwise falls back to the base avatar.
  const resolvedCombined = useMemo(
    () => resolveCombinedAvatar(clothingConfig),
    [clothingConfig],
  );

  const avatarSource     = resolvedCombined?.asset ?? AVATAR_MODEL;
  const isUsingCombined  = resolvedCombined != null;

  // CRITICAL: the rotate array MUST be memoized.
  //
  // react-native-filament's useApplyTransformations runs a single useEffect
  // whose deps include the rotate array.  Inside that effect:
  //   1. transformToUnitCube is applied UNCONDITIONALLY (resets the matrix)
  //   2. rotate is applied only when areFloat3Equal(new, prev) is FALSE
  //
  // An inline array `[x, rotationY, z]` creates a new JS reference every
  // render.  React sees the new reference → re-runs the effect → step 1
  // resets the matrix → step 2 skips rotation because the VALUES haven't
  // changed → model snaps to the raw unit cube orientation (lies flat).
  //
  // useMemo keeps the same array reference when the values don't change,
  // preventing the effect from re-running on unrelated state changes
  // (e.g. clothingConfig update from an outfit switch that resolves to
  // the same combined avatar).
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

  useEffect(() => {
    if (__DEV__) {
      const label = resolvedCombined?.debugName ?? 'avatar_base_male.glb';
      console.log(`[Avatar] Model: ${isUsingCombined ? 'COMBINED' : 'BASE'} → ${label}`);
      if (resolvedCombined) {
        const fmt = (c: readonly number[]) => c.map(v => v.toFixed(3)).join(',');
        console.log(
          `[Avatar] Tint: top=[${fmt(resolvedCombined.topColor)}]` +
          ` bottom=[${fmt(resolvedCombined.bottomColor)}]`,
        );
        // Confirm exact node names being targeted. If EntitySelector silently
        // falls through to TintBoundary, these lines confirm what name was used.
        console.log(
          `[Avatar] Targeting nodes: top="${COMBINED_NODE_TOP}" bottom="${COMBINED_NODE_BOTTOM}"` +
          ` — Male_body excluded (untinted)`,
        );
      }
    }
  }, [resolvedCombined, isUsingCombined]);

  useImperativeHandle(ref, () => ({
    setRotationY(deg) {
      rotationYRef.current = deg;
      setRotationY(deg);
    },
    getRotationY() {
      return rotationYRef.current;
    },
    setClothingConfig(config) {
      clothingConfigRef.current = config;
      if (__DEV__) {
        console.log('[Avatar] Clothing config applied:', {
          top:    config.top    ? `${config.top.assetFamily} | tint=${config.top.tintPrimary ?? 'none'} | ${config.top.materialPreset}` : null,
          bottom: config.bottom ? `${config.bottom.assetFamily} | tint=${config.bottom.tintPrimary ?? 'none'} | ${config.bottom.materialPreset}` : null,
        });
      }
      setClothingConfigState(config);
    },
    getClothingConfig() {
      return clothingConfigRef.current;
    },
  }), []);  // safe: all captured values (setRotationY, setClothingConfigState, clothingConfigRef) are stable

  // Material tint parameters — memoized on the resolved result to avoid
  // unnecessary worklet re-runs during drag (where only modelRotation changes).
  const topMaterialParams = useMemo(
    () => resolvedCombined
      ? {index: 0, parameters: {baseColorFactor: resolvedCombined.topColor}}
      : null,
    [resolvedCombined],
  );
  const bottomMaterialParams = useMemo(
    () => resolvedCombined
      ? {index: 0, parameters: {baseColorFactor: resolvedCombined.bottomColor}}
      : null,
    [resolvedCombined],
  );

  return (
    <FilamentView style={styles.filamentView}>
      <StaticSceneParts />
      {/*
       * Avatar model — combined dressed or base.
       *
       * rotate={modelRotation} uses a useMemo'd array — see the critical
       * comment above explaining why this prevents the transformToUnitCube
       * orientation-reset bug in useApplyTransformations.
       *
       * key={avatarSource} forces unmount+remount when source changes.
       *
       * EntitySelector children apply baseColorFactor tinting to the
       * clothing mesh regions of the combined GLB.  TintBoundary catches
       * throws from name mismatches so the avatar renders untinted rather
       * than crashing.
       */}
      <Model
        key={avatarSource}
        source={avatarSource}
        transformToUnitCube
        rotate={modelRotation}>
        {isUsingCombined && (
          <>
            {/*
             * Body skin tone — always applied when the combined avatar is active.
             * Separate TintBoundary so a node-name miss here cannot suppress
             * the clothing tints below.
             */}
            <TintBoundary>
              <EntitySelector
                byName={COMBINED_NODE_BODY}
                materialParameters={BODY_MATERIAL_PARAMS}
              />
            </TintBoundary>
            {/* Clothing tints — conditional on colors being resolved. */}
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

// AvatarStage wraps FilamentScene + SceneContent in a memo boundary so that
// any future re-renders of Avatar3DScreen (e.g. insets change) cannot cascade
// into the Filament engine. sceneRef is a stable object → memo never invalidates.
const AvatarStage = React.memo(function AvatarStage(
  {sceneRef}: Readonly<{sceneRef: React.RefObject<SceneHandle | null>}>,
) {
  return (
    <FilamentScene>
      <SceneContent ref={sceneRef} />
    </FilamentScene>
  );
});

export default function Avatar3DScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const savedOutfit = (route?.params as any)?.savedOutfit ?? null;

  // SceneContent is driven entirely via imperative handle — no rotation state here.
  const sceneRef = useRef<SceneHandle>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const addSavedOutfit = useSavedOutfits(s => s.add);
  const savedItems = useSavedOutfits(s => s.items);
  const fetchAllSaved = useSavedOutfits(s => s.fetchAll);
  const loadedFromSaved = useRef(false);

  // Keep the saved store fresh so isSaved derives correctly.
  useEffect(() => {
    fetchAllSaved().catch(() => {});
  }, []);

  // Snapshot of rotationY taken at gesture start (read from scene, not a local
  // accumulator, so inertia position is always the anchor for the next drag).
  const baseAtGestureStart = useRef(0);

  // ── Occasion state ───────────────────────────────────────────────────────────
  const [occasionIndex, setOccasionIndex] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  // Measured height of the occasion row so the dropdown can position itself flush below it.
  const [occasionRowHeight, setOccasionRowHeight] = useState(0);

  // ── Suggestion state ─────────────────────────────────────────────────────────
  const [suggestions, setSuggestions] = useState<ReasonedOutfitEntry[]>([]);
  const [outfitIndex, setOutfitIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [reasonModalVisible, setReasonModalVisible] = useState(false);

  // Derive isSaved from the store — true if the current outfit's item IDs
  // match any saved outfit. This persists across navigation and tab switches.
  // MUST be declared after suggestions and outfitIndex useState.
  const isSaved = useMemo(() => {
    if (suggestions.length === 0) return false;
    const current = suggestions[outfitIndex];
    if (!current) return false;
    const currentIds = current.items
      .map((i: any) => i.id || i._id)
      .filter(Boolean)
      .sort()
      .join(',');
    if (!currentIds) return false;
    return savedItems.some(saved => {
      const savedIds = saved.items
        .map((i: any) => i.id || i._id)
        .filter(Boolean)
        .sort()
        .join(',');
      return savedIds === currentIds;
    });
  }, [suggestions, outfitIndex, savedItems]);

  // ── Dropdown handlers ────────────────────────────────────────────────────────
  const toggleDropdown  = () => setDropdownOpen(prev => !prev);
  const closeDropdown   = () => setDropdownOpen(false);
  const selectOccasion  = (index: number) => {
    setOccasionIndex(index);
    setDropdownOpen(false);
  };

  // ── Avatar clothing config resolution ────────────────────────────────────────
  // Resolves /avatar-mapping for the currently displayed outfit and pushes the
  // result to SceneContent imperatively. A cancellation flag ensures that only
  // the response for the LATEST outfit is applied — stale responses from
  // previous outfits or prior Generate presses are silently discarded.
  useEffect(() => {
    if (suggestions.length === 0) return;
    loadedFromSaved.current = false;

    let cancelled = false;

    (async () => {
      try {
        const outfit = suggestions[outfitIndex];
        const mappings = await fetchOutfitAvatarMappings(outfit.items);
        if (cancelled) return;
        const config = buildRenderConfig(mappings);
        sceneRef.current?.setClothingConfig(config);
      } catch (err) {
        if (__DEV__) {
          console.warn('[Avatar] resolveClothingConfig failed:', err);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [outfitIndex, suggestions]);

  // ── Load from saved outfit if opened from SavedScreen ────────────────────────
  useEffect(() => {
    if (!savedOutfit) return;
    // Signal that the upcoming suggestions change comes from a saved outfit —
    // prevents the [outfitIndex, suggestions] effect from clearing isSaved.
    loadedFromSaved.current = true;
    setHasGenerated(true);
    setSuggestions([
      {
        outfitId: savedOutfit._id,
        items: savedOutfit.items,
        reasons: savedOutfit.reasons,
      },
    ]);
    // avatarRenderConfig is applied by [outfitIndex, suggestions] via
    // fetchOutfitAvatarMappings, which re-derives the config from item data.
    // This is more reliable than calling setClothingConfig here while
    // Filament may still be initialising.
  }, [savedOutfit]);

  // ── Save handler ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (saveLoading || suggestions.length === 0) return;

    const outfit = suggestions[outfitIndex];
    const occasion = OCCASIONS[occasionIndex]?.value ?? null;

    // Read current clothing config from scene
    const avatarRenderConfig = sceneRef.current
      ? sceneRef.current.getClothingConfig()
      : null;

    const payload: CreateSavedOutfitPayload = {
      occasion,
      items: outfit.items,
      reasons: outfit.reasons ?? [],
      avatarRenderConfig,
    };

    setSaveLoading(true);
    try {
      await addSavedOutfit(payload);
      Alert.alert('Saved!', 'Outfit added to your Saved collection.');
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.response?.data?.error || err?.message || 'Please try again.';
      Alert.alert('Could not save', detail);
    } finally {
      setSaveLoading(false);
    }
  };

  // ── Generate handler ─────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await getReasonedOutfits({occasion: OCCASIONS[occasionIndex].value});
      const outfits = res.outfits.slice(0, 3);
      setSuggestions(outfits);
      setOutfitIndex(0);
      setReasonModalVisible(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate. Please try again.';
      setGenerateError(message);
    } finally {
      setIsGenerating(false);
      setHasGenerated(true);
    }
  };

  // ── Arrow navigation ─────────────────────────────────────────────────────────
  const goToPrev = () => {
    setOutfitIndex(i => (i - 1 + suggestions.length) % suggestions.length);
    setReasonModalVisible(false);
  };
  const goToNext = () => {
    setOutfitIndex(i => (i + 1) % suggestions.length);
    setReasonModalVisible(false);
  };

  const panResponder = useRef(
    PanResponder.create({
      // Claim horizontal moves; pass vertical scrolls to the parent.
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderGrant: () => {
        // Anchor from the exact persisted angle so no snap occurs between drags.
        baseAtGestureStart.current = sceneRef.current?.getRotationY() ?? 0;
      },
      onPanResponderMove: (_, gs) => {
        const nextY = baseAtGestureStart.current + gs.dx * ROTATION_SENSITIVITY;
        sceneRef.current?.setRotationY(nextY);
      },
      // No onRelease / onTerminate: nothing changes on release, so Model is
      // never re-rendered, transformToUnitCube is never re-run, and the final
      // rotation angle is preserved exactly where the finger stopped.
    }),
  ).current;

  // ── Suggestion panel ─────────────────────────────────────────────────────────
  // Always rendered — makes the panel a persistent section, not a popup banner.
  // States: idle → loading → (error | empty | outfits)
  const renderSuggestionPanel = () => {
    // ── Decide header right-side content ────────────────────────────────────
    const headerRight = (hasGenerated && !isGenerating && !generateError && suggestions.length > 0)
      ? <Text style={styles.outfitCounter}>{outfitIndex + 1} / {suggestions.length}</Text>
      : null;

    // ── Decide body ──────────────────────────────────────────────────────────
    let body: React.ReactNode;

    if (isGenerating) {
      // Loading
      body = (
        <View style={styles.panelLoadingRow}>
          <ActivityIndicator color={TITLE_COLOR} size="small" />
          <Text style={styles.panelMeta} numberOfLines={1}>Generating suggestions…</Text>
        </View>
      );
    } else if (generateError) {
      // Error
      body = (
        <>
          <Text style={styles.panelPrimary} numberOfLines={1}>Couldn't load suggestions</Text>
          <Text style={styles.panelMeta} numberOfLines={2}>Tap Generate to try again</Text>
        </>
      );
    } else if (!hasGenerated) {
      // Idle — before any generate attempt
      body = (
        <Text style={styles.panelMeta} numberOfLines={2}>Select an occasion above and tap Generate</Text>
      );
    } else if (suggestions.length === 0) {
      // Empty
      body = (
        <>
          <Text style={styles.panelPrimary} numberOfLines={1}>No outfit suggestions yet</Text>
          <Text style={styles.panelMeta} numberOfLines={2}>Add more clothes to your closet and try again</Text>
        </>
      );
    } else {
      // Outfits available
      const canNavigate = suggestions.length > 1;
      const current = suggestions[outfitIndex];
      const firstReason = current?.reasons?.[0] ?? null;

      const reasonLabel = firstReason ?? `${suggestions.length} outfit${suggestions.length > 1 ? 's' : ''} ready`;
      const showReadMore = firstReason != null && firstReason.length > 80;

      body = (
        <View style={styles.outfitContent}>
          <Text style={styles.reasonText} numberOfLines={2}>
            {reasonLabel}
          </Text>

          <View style={[
            styles.outfitFooter,
            !showReadMore && styles.outfitFooterCenter,
          ]}>
            {showReadMore && (
              <TouchableOpacity
                onPress={() => setReasonModalVisible(true)}
                hitSlop={{top: 6, bottom: 6, left: 8, right: 8}}
                accessibilityRole="button"
                accessibilityLabel="Read full suggestion">
                <Text style={styles.readMoreText}>Read more</Text>
              </TouchableOpacity>
            )}

            <View style={styles.outfitNav}>
              <TouchableOpacity
                style={[styles.arrowBtn, !canNavigate && styles.arrowBtnDisabled]}
                onPress={goToPrev}
                disabled={!canNavigate}
                accessibilityRole="button"
                accessibilityLabel="Previous outfit">
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={canNavigate ? TITLE_COLOR : DISABLED_COLOR}
                />
              </TouchableOpacity>

              {canNavigate && (
                <View style={styles.dotsRow}>
                  {suggestions.map((s, i) => (
                    <View
                      key={s.outfitId ?? `dot-${i}`}
                      style={[styles.dot, i === outfitIndex && styles.dotActive]}
                    />
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[styles.arrowBtn, !canNavigate && styles.arrowBtnDisabled]}
                onPress={goToNext}
                disabled={!canNavigate}
                accessibilityRole="button"
                accessibilityLabel="Next outfit">
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={canNavigate ? TITLE_COLOR : DISABLED_COLOR}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.suggestionPanel}>
        {/* Consistent header across all states */}
        <View style={styles.panelHeader}>
          <Text style={styles.panelLabel}>OUTFIT SUGGESTIONS</Text>
          {headerRight}
        </View>
        <View style={styles.panelDivider} />
        {/* State-specific body */}
        <View style={styles.panelBody}>
          {body}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>

      {/* ── Dropdown backdrop — transparent full-screen tap target ── */}
      {dropdownOpen && (
        <Pressable style={styles.dropdownBackdrop} onPress={closeDropdown} />
      )}

      {/* ── Header ───────────────────────────────────────────────── */}
      <View style={[styles.header, {paddingTop: insets.top + 8}]}>
        <Text style={styles.title}>My Avatar</Text>
      </View>

      {/* ── Top controls: occasion selector + generate button ─────── */}
      {/*   zIndex elevation lets the dropdown overlay the content below */}
      <View style={[styles.controls, dropdownOpen && styles.controlsElevated]}>

        {/* Occasion selector — wrapper measured so dropdown sits flush below */}
        <View
          onLayout={e => setOccasionRowHeight(e.nativeEvent.layout.height)}
          style={styles.occasionWrapper}>

          <TouchableOpacity
            style={styles.occasionRow}
            activeOpacity={0.7}
            onPress={toggleDropdown}
            accessibilityRole="button"
            accessibilityLabel="Select occasion">
            <Text style={styles.occasionText}>{OCCASIONS[occasionIndex].label}</Text>
            <Ionicons
              name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={CHEVRON_COLOR}
            />
          </TouchableOpacity>

          {/* Custom in-page dropdown — absolute, flush below the occasion row */}
          {dropdownOpen && (
            <View style={[styles.dropdown, {top: occasionRowHeight + 4}]}>
              {OCCASIONS.map((o, i) => (
                <React.Fragment key={o.value}>
                  {i > 0 && <View style={styles.dropdownDivider} />}
                  <TouchableOpacity
                    style={[
                      styles.dropdownItem,
                      i === occasionIndex && styles.dropdownItemActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => selectOccasion(i)}
                    accessibilityRole="button"
                    accessibilityLabel={o.label}>
                    <Text
                      style={[
                        styles.dropdownItemText,
                        i === occasionIndex && styles.dropdownItemTextActive,
                      ]}>
                      {o.label}
                    </Text>
                    {i === occasionIndex && (
                      <Ionicons name="checkmark" size={14} color={TITLE_COLOR} />
                    )}
                  </TouchableOpacity>
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* Generate button */}
        <TouchableOpacity
          style={[styles.generateBtn, isGenerating && styles.generateBtnDisabled]}
          activeOpacity={0.85}
          onPress={() => { void handleGenerate(); }}
          disabled={isGenerating}
          accessibilityRole="button"
          accessibilityLabel="Generate outfit">
          <Text style={styles.generateText}>
            {isGenerating ? 'Generating…' : 'Generate'}
          </Text>
        </TouchableOpacity>

      </View>

      {/* ── Outfit suggestion panel ───────────────────────────────── */}
      {renderSuggestionPanel()}

      {/* ── 3D Stage card — ~60 % of remaining vertical space ───────
           flex: 3 vs the actionRow's implicit fixed height keeps the
           stage dominant while giving clear room to the controls above
           and the action row below.                                   */}
      <View style={styles.stageWrapper}>
        <View style={styles.stageCard}>
          {/* FilamentScene does not accept a style prop — sized via View */}
          <View style={styles.sceneContainer} {...panResponder.panHandlers}>
            <AvatarStage sceneRef={sceneRef} />
          </View>
        </View>
      </View>

      {/* ── Bottom action row: emoji buttons ─────────────────────── */}
      <View style={[styles.actionRow, {paddingBottom: insets.bottom + 10}]}>

        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Like outfit">
          <Text style={styles.actionEmoji}>❤️</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Regenerate outfit"
          disabled={isGenerating}
          onPress={() => { void handleGenerate(); }}>
          <Ionicons
            name="refresh"
            size={26}
            color={isGenerating ? 'rgba(255,255,255,0.3)' : '#FFFFFF'}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, isSaved && { backgroundColor: 'rgba(255,200,0,0.18)' }]}
          onPress={() => { void handleSave(); }}
          disabled={saveLoading || suggestions.length === 0}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Save outfit">
          <Ionicons
            name={isSaved ? 'star' : 'star-outline'}
            size={26}
            color={isSaved ? '#FFD700' : '#FFFFFF'}
          />
        </TouchableOpacity>

      </View>

      {/* ── Reason detail bottom sheet ─────────────────────────────── */}
      <Modal
        visible={reasonModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReasonModalVisible(false)}>
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setReasonModalVisible(false)}>
          <Pressable
            style={[styles.modalCard, {paddingBottom: Math.max(insets.bottom, 16)}]}
            onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>OUTFIT SUGGESTION</Text>
              <View style={styles.modalHeaderRight}>
                {suggestions.length > 1 && (
                  <Text style={styles.modalCounter}>
                    {outfitIndex + 1} / {suggestions.length}
                  </Text>
                )}
                <TouchableOpacity
                  onPress={() => setReasonModalVisible(false)}
                  hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
                  accessibilityRole="button"
                  accessibilityLabel="Close">
                  <Ionicons name="close" size={20} color={TITLE_COLOR} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.modalDivider} />
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              bounces={false}>
              <Text style={styles.modalText}>
                {suggestions[outfitIndex]?.reasons?.[0] ?? ''}
              </Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

    </View>
  );
}

// ── Palette ───────────────────────────────────────────────────────────────────
// Intentionally dark-stage regardless of app light/dark toggle.
// Warm-brown dark tones match the brand (primary: #3D3426, primaryDark: #2A2318).
const STAGE_BG      = '#1C1812';                      // page background
const CARD_BG       = '#252018';                      // stage card surface
const CARD_BORDER   = 'rgba(196, 168, 130, 0.20)';   // accent at low opacity
const TITLE_COLOR   = '#C4A882';                      // accent gold
const CONTROL_BG    = '#27201A';                      // slightly lighter than page
const CONTROL_BORDER= 'rgba(196, 168, 130, 0.18)';
const CHEVRON_COLOR = 'rgba(196, 168, 130, 0.55)';
const ACTION_BG     = 'rgba(255, 255, 255, 0.07)';   // subtle glass
const DISABLED_COLOR = 'rgba(196, 168, 130, 0.25)';  // muted gold for disabled arrows

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: STAGE_BG,
  },

  // ── Header ─────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 24,
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: TITLE_COLOR,
    letterSpacing: 0.5,
  },

  // ── Top controls ───────────────────────────────────────────────
  controls: {
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 10,
  },
  // Raised above the dropdown backdrop when open so the dropdown is interactive.
  controlsElevated: {
    zIndex: 20,
  },
  // Wrapper around the occasion row — measured so dropdown can be placed flush below.
  occasionWrapper: {
    // position:relative is the RN default; no additional props needed here.
  },
  occasionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CONTROL_BG,
    borderWidth: 1,
    borderColor: CONTROL_BORDER,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  occasionText: {
    fontSize: 15,
    color: TITLE_COLOR,
    fontWeight: '400',
  },
  // ── Custom in-page dropdown ─────────────────────────────────────
  dropdownBackdrop: {
    // Full-screen transparent Pressable rendered below the controls (zIndex: 10)
    // so tapping anywhere outside the dropdown closes it.
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 10,
  },
  dropdown: {
    position: 'absolute',
    left: 0,
    right: 0,
    // `top` is set dynamically in JSX: occasionRowHeight + 4
    backgroundColor: CONTROL_BG,
    borderWidth: 1,
    borderColor: CONTROL_BORDER,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 12,
    zIndex: 30,
  },
  dropdownDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: CONTROL_BORDER,
    marginHorizontal: 12,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(196, 168, 130, 0.10)',
  },
  dropdownItemText: {
    fontSize: 15,
    fontWeight: '400',
    color: CHEVRON_COLOR,
  },
  dropdownItemTextActive: {
    color: TITLE_COLOR,
    fontWeight: '500',
  },
  generateBtn: {
    alignSelf: 'center',
    backgroundColor: TITLE_COLOR,   // solid accent gold
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 44,
  },
  generateBtnDisabled: {
    opacity: 0.6,
  },
  generateText: {
    fontSize: 15,
    fontWeight: '600',
    color: STAGE_BG,                // dark text on gold — readable
    letterSpacing: 0.4,
  },

  // ── Suggestion panel ───────────────────────────────────────────
  // Permanent section — visible in all states (idle, loading, error, empty, outfits).
  suggestionPanel: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: CONTROL_BG,
    borderWidth: 1,
    borderColor: CONTROL_BORDER,
    borderRadius: 12,
    overflow: 'hidden',
    flexShrink: 1,
  },
  // Header: label left, optional counter right — consistent across all states
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 5,
  },
  panelLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: DISABLED_COLOR,
  },
  outfitCounter: {
    fontSize: 11,
    fontWeight: '500',
    color: CHEVRON_COLOR,
    letterSpacing: 0.3,
  },
  panelDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: CONTROL_BORDER,
    marginHorizontal: 12,
  },
  // Body: state-specific content
  panelBody: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
    alignItems: 'center',
    flexShrink: 1,
    overflow: 'hidden',
  },
  // Shared text styles used across states
  panelPrimary: {
    fontSize: 13,
    fontWeight: '500',
    color: TITLE_COLOR,
    textAlign: 'center',
  },
  panelMeta: {
    fontSize: 11,
    color: CHEVRON_COLOR,
    textAlign: 'center',
    marginTop: 3,
  },
  // Loading row: spinner + text side by side
  panelLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Outfit content: preview text + compact footer (read-more + nav)
  outfitContent: {
    alignSelf: 'stretch',
  },
  reasonText: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    color: TITLE_COLOR,
    textAlign: 'left',
  },
  outfitFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  outfitFooterCenter: {
    justifyContent: 'center',
  },
  readMoreText: {
    fontSize: 11,
    fontWeight: '600',
    color: CHEVRON_COLOR,
  },
  outfitNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: DISABLED_COLOR,
  },
  dotActive: {
    backgroundColor: TITLE_COLOR,
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(196, 168, 130, 0.08)',
    borderWidth: 1,
    borderColor: CONTROL_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowBtnDisabled: {
    opacity: 0.4,
  },

  // ── Reason detail bottom-sheet modal ───────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: CONTROL_BG,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '45%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  modalHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: DISABLED_COLOR,
  },
  modalCounter: {
    fontSize: 12,
    fontWeight: '500',
    color: CHEVRON_COLOR,
  },
  modalDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: CONTROL_BORDER,
    marginHorizontal: 16,
  },
  modalScroll: {
    paddingHorizontal: 16,
  },
  modalScrollContent: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  modalText: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    color: TITLE_COLOR,
  },

  // ── Stage card ─────────────────────────────────────────────────
  stageWrapper: {
    flex: 1,
    minHeight: 180,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  stageCard: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.55,
    shadowRadius: 16,
  },
  sceneContainer: {
    flex: 1,
  },
  filamentView: {
    flex: 1,
  },

  // ── Action row ─────────────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingTop: 10,
    paddingHorizontal: 24,
  },
  actionBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ACTION_BG,
    borderWidth: 1,
    borderColor: CONTROL_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  actionEmoji: {
    fontSize: 22,
  },

});
