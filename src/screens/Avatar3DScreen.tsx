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
  PanResponder,
  Pressable,
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
  FilamentScene,
  FilamentView,
  Model,
} from 'react-native-filament';
import {getReasonedOutfits, ReasonedOutfitEntry} from '../api/ai';
import {fetchOutfitAvatarMappings} from '../api/avatar';
import {
  AvatarRenderConfig,
  buildRenderConfig,
  EMPTY_RENDER_CONFIG,
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

// ── Imperative handle exposed by SceneContent ─────────────────────────────────
// Methods reference only refs/stable setters → no stale closures.
export interface SceneHandle {
  setRotationY: (deg: number) => void;
  // Returns the authoritative current rotationY so onGrant anchors correctly
  // across consecutive drags with no snap and no accumulated drift.
  getRotationY: () => number;
  // Push a new clothing config into the scene without triggering a React re-render
  // on the memo-guarded AvatarStage. Phase 1: stores + logs the config so the
  // hookup point is defined. Phase 2: will trigger .glb asset swapping here.
  setClothingConfig: (config: AvatarRenderConfig) => void;
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarSource]);

  useImperativeHandle(ref, () => ({
    setRotationY(deg) {
      rotationYRef.current = deg;
      setRotationY(deg);
    },
    getRotationY() {
      return rotationYRef.current;
    },
    setClothingConfig(config) {
      if (__DEV__) {
        console.log('[Avatar] Clothing config applied:', {
          top:    config.top    ? `${config.top.assetFamily} | tint=${config.top.tintPrimary ?? 'none'} | ${config.top.materialPreset}` : null,
          bottom: config.bottom ? `${config.bottom.assetFamily} | tint=${config.bottom.tintPrimary ?? 'none'} | ${config.bottom.materialPreset}` : null,
        });
      }
      setClothingConfigState(config);
    },
  }), []);  // safe: all captured values (setRotationY, setClothingConfigState) are stable

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
       */}
      <Model
        key={avatarSource}
        source={avatarSource}
        transformToUnitCube
        rotate={modelRotation}
      />
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

  // SceneContent is driven entirely via imperative handle — no rotation state here.
  const sceneRef = useRef<SceneHandle>(null);
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

  // ── Generate handler ─────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await getReasonedOutfits({occasion: OCCASIONS[occasionIndex].value});
      const outfits = res.outfits.slice(0, 3);
      setSuggestions(outfits);
      setOutfitIndex(0);
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
  };
  const goToNext = () => {
    setOutfitIndex(i => (i + 1) % suggestions.length);
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
          <Text style={styles.panelMeta}>Generating suggestions…</Text>
        </View>
      );
    } else if (generateError) {
      // Error
      body = (
        <>
          <Text style={styles.panelPrimary}>Couldn't load suggestions</Text>
          <Text style={styles.panelMeta}>Tap Generate to try again</Text>
        </>
      );
    } else if (!hasGenerated) {
      // Idle — before any generate attempt
      body = (
        <Text style={styles.panelMeta}>Select an occasion above and tap Generate</Text>
      );
    } else if (suggestions.length === 0) {
      // Empty
      body = (
        <>
          <Text style={styles.panelPrimary}>No outfit suggestions yet</Text>
          <Text style={styles.panelMeta}>Add more clothes to your closet and try again</Text>
        </>
      );
    } else {
      // Outfits available
      const canNavigate = suggestions.length > 1;
      const current = suggestions[outfitIndex];
      const firstReason = current?.reasons?.[0] ?? null;

      body = (
        <View style={styles.outfitRow}>
          {/* Left arrow */}
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

          {/* Centre: reason + position dots */}
          <View style={styles.outfitBody}>
            <Text style={styles.panelPrimary} numberOfLines={2}>
              {firstReason ?? `${suggestions.length} outfit${suggestions.length > 1 ? 's' : ''} ready`}
            </Text>
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
          </View>

          {/* Right arrow */}
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
          accessibilityLabel="Regenerate outfit">
          <Text style={styles.actionEmoji}>🔄</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Favourite outfit">
          <Text style={styles.actionEmoji}>⭐</Text>
        </TouchableOpacity>

      </View>

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
  },
  // Header: label left, optional counter right — consistent across all states
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 7,
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
    paddingTop: 10,
    paddingBottom: 12,
    alignItems: 'center',
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
  // Outfit row: arrows flanking centre content
  outfitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  outfitBody: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 6,
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

  // ── Stage card ─────────────────────────────────────────────────
  stageWrapper: {
    flex: 1,
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
