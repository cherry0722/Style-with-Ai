/**
 * Avatar3DScreen — feature/avatar-glb-base
 *
 * Dedicated stage for the user's 3D avatar.
 * Layout: header → stage card (flex) → reserved bottom strip for future controls.
 *
 * Rendering architecture (unchanged — required by react-native-filament):
 *
 *   FilamentScene   — initialises the Filament engine; provides
 *                     FilamentContext + RenderCallbackContext to children
 *     └─ SceneContent  — MUST be a separate child component so both contexts
 *                        are available when hooks inside Camera/Model run
 *          └─ FilamentView   — the Metal surface
 *               ├─ Camera        — default position [0, 0, 8], target origin
 *               ├─ DefaultLight  — IBL (RNF_default_env_ibl.ktx) + directional
 *               └─ Model         — loads avatar.glb via useModel internally
 *
 * Model path: assets/models/avatar.glb
 *   Metro resolves .glb via the assetExts entry in metro.config.js.
 */

import React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
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

// SceneContent is a separate component — FilamentContext must propagate
// before the hooks inside Camera, DefaultLight, and Model execute.
function SceneContent() {
  return (
    <FilamentView style={styles.filamentView}>
      {/*
       * Camera tuning — full-body framing.
       *
       * Key fact from RNFTransformManagerImpl.cpp:
       *   transformToUnitCube scales by 2.0 / maxExtent, so the model's
       *   dominant axis spans ±1 unit (2 units total), NOT ±0.5.
       *
       * At Z=3.5 / 55 mm the horizontal visible half-width was only
       *   3.5 × (18/55) = 1.145 units
       * leaving just 0.145 units clearance around arms at ±1.0 — so any
       * pose with arms near full extension clips immediately.
       *
       *   cameraPosition  [0, 0, 4.5]
       *     → horizontal half-width = 4.5 × (18/50) = 1.62 units
       *       → 0.62 units clearance around arms at ±1.0  (62% margin)
       *     → vertical half-height (aspect ≈ 0.85)
       *          = 4.5 × (18 / (50 × 0.85)) = 1.91 units
       *       → 0.91 units clearance above head at +1.0  (91% margin)
       *
       *   cameraTarget    [0, 0, 0]   — centre of the normalised cube
       *   focalLength     50 mm       — natural portrait lens; going wider
       *                                 would distort the figure
       */}
      <Camera
        cameraPosition={[0, 0, 4.5]}
        cameraTarget={[0, 0, 0]}
        focalLengthInMillimeters={50}
      />
      <DefaultLight />
      {/*
       * transformToUnitCube normalises the model to a 1×1×1 cube at the
       * origin regardless of the GLB's original scale units.  This makes
       * the camera settings above reliable for any human-figure GLB.
       */}
      <Model source={AVATAR_MODEL} transformToUnitCube />
    </FilamentView>
  );
}

export default function Avatar3DScreen() {
  const insets = useSafeAreaInsets();

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
          <View style={styles.sceneContainer}>
            <FilamentScene>
              <SceneContent />
            </FilamentScene>
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
