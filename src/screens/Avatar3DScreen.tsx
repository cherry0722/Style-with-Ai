/**
 * Avatar3DScreen — feature/avatar-glb-base
 *
 * Full-screen 3D viewer for the user's avatar .glb model.
 * Rendered via react-native-filament (Metal on iOS).
 *
 * Architecture (required by react-native-filament context propagation):
 *
 *   FilamentScene   — initialises the Filament engine; provides
 *                     FilamentContext + RenderCallbackContext to children
 *     └─ SceneContent  — MUST be a separate child component, not inline,
 *                        so both contexts are available when hooks run
 *          └─ FilamentView   — the Metal surface (fills parent)
 *               ├─ Camera        — default position [0, 0, 8], target origin
 *               ├─ DefaultLight  — IBL (RNF_default_env_ibl.ktx) + directional
 *               └─ Model         — loads avatar.glb via useModel internally
 *
 * Model path: assets/models/avatar.glb
 *   Metro resolves .glb via the assetExts entry in metro.config.js.
 *   Place the file at that path before starting Metro — require() is
 *   resolved at bundle time.
 */

import React from 'react';
import {StyleSheet, View} from 'react-native';
import {
  Camera,
  DefaultLight,
  FilamentScene,
  FilamentView,
  Model,
} from 'react-native-filament';

// Metro resolves .glb as a bundled asset (configured in metro.config.js).
// Place assets/models/avatar.glb before starting Metro.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AVATAR_MODEL = require('../../assets/models/avatar.glb');

function SceneContent() {
  return (
    <FilamentView style={styles.filamentView}>
      <Camera />
      <DefaultLight />
      <Model source={AVATAR_MODEL} />
    </FilamentView>
  );
}

export default function Avatar3DScreen() {
  return (
    <View style={styles.root}>
      {/* FilamentScene does not accept a style prop — sized via the View wrapper */}
      <View style={styles.scene}>
        <FilamentScene>
          <SceneContent />
        </FilamentScene>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  scene: {
    flex: 1,
  },
  filamentView: {
    flex: 1,
  },
});
