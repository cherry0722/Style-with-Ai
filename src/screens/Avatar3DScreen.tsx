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
 *               └─ Model  — receives rotate prop; only this subtree updates per frame.
 *
 * Rotation isolation strategy (two layers):
 *   1. Avatar3DScreen holds NO rotation state. PanResponder calls
 *      sceneRef.current.setRotationY() imperatively → zero outer re-renders.
 *   2. StaticSceneParts is React.memo'd with no props → Camera and DefaultLight
 *      are never re-rendered even when SceneContent's rotationY state changes.
 *
 * Model path: assets/models/avatar.glb
 *   Metro resolves .glb via the assetExts entry in metro.config.js.
 */

import React, {useImperativeHandle, useRef, useState} from 'react';
import {PanResponder, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Ionicons} from '@expo/vector-icons';
import {
  Camera,
  DefaultLight,
  FilamentScene,
  FilamentView,
  Model,
} from 'react-native-filament';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const AVATAR_MODEL = require('../../assets/models/avatar.glb');

// ── Interaction constants ──────────────────────────────────────────────────────
const ROTATION_SENSITIVITY = 0.4;  // deg/px  (225 px swipe ≈ 90°, full 360° possible)

// NOTE: no scale feedback prop is passed to Model.
// useApplyTransformations (react-native-filament internal) only re-applies
// rotate when its value *changes*. If any other Model prop changes while rotate
// stays the same, transformToUnitCube resets the matrix but rotate is skipped
// (areFloat3Equal guard), causing a snap back to front. Keeping rotate as the
// ONLY changing prop avoids that entirely.

// ── Imperative handle exposed by SceneContent ─────────────────────────────────
// Methods reference only refs/stable setters → no stale closures.
export interface SceneHandle {
  setRotationY: (deg: number) => void;
  // Returns the authoritative current rotationY so onGrant anchors correctly
  // across consecutive drags with no snap and no accumulated drift.
  getRotationY: () => number;
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

  useImperativeHandle(ref, () => ({
    setRotationY(deg) {
      rotationYRef.current = deg;
      setRotationY(deg);
    },
    getRotationY() {
      return rotationYRef.current;
    },
  }), []);

  return (
    <FilamentView style={styles.filamentView}>
      <StaticSceneParts />
      {/*
       * transformToUnitCube normalises the model to a 1×1×1 cube at the
       * origin regardless of the GLB's original scale units.
       *
       * rotate=[0, rotationY, 0] — Y-axis only; avatar stays perfectly upright.
       *
       * No scale prop: changing any prop other than rotate while rotate is
       * unchanged causes useApplyTransformations to re-run transformToUnitCube
       * (resetting rotation) without re-applying rotate (areFloat3Equal guard
       * skips it) → snap back to front. Keeping rotate as the only changing
       * prop avoids this entirely.
       */}
      <Model
        source={AVATAR_MODEL}
        transformToUnitCube
        rotate={[0, rotationY, 0]}
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

  return (
    <View style={styles.root}>

      {/* ── Header ───────────────────────────────────────────────── */}
      <View style={[styles.header, {paddingTop: insets.top + 8}]}>
        <Text style={styles.title}>My Avatar</Text>
      </View>

      {/* ── Top controls: occasion selector + generate button ─────── */}
      <View style={styles.controls}>

        {/* Occasion selector row */}
        <TouchableOpacity
          style={styles.occasionRow}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Select occasion">
          <Text style={styles.occasionText}>Select the occasion</Text>
          <Ionicons name="chevron-down" size={18} color={CHEVRON_COLOR} />
        </TouchableOpacity>

        {/* Generate button */}
        <TouchableOpacity
          style={styles.generateBtn}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Generate outfit">
          <Text style={styles.generateText}>Generate</Text>
        </TouchableOpacity>

      </View>

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
    marginBottom: 12,
    gap: 10,
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
    color: 'rgba(196, 168, 130, 0.55)',
    fontWeight: '400',
  },
  generateBtn: {
    alignSelf: 'center',
    backgroundColor: TITLE_COLOR,   // solid accent gold
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 44,
  },
  generateText: {
    fontSize: 15,
    fontWeight: '600',
    color: STAGE_BG,                // dark text on gold — readable
    letterSpacing: 0.4,
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
