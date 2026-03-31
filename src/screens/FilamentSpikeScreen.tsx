/**
 * FilamentSpikeScreen — Milestone 1
 *
 * Minimal proof-of-concept: loads assets/models/avatar/avatar_base_male.glb and renders it
 * using react-native-filament. No MYRA business logic.
 *
 * Architecture (confirmed from package source):
 *
 *   FilamentScene  ← provides FilamentContext (engine, camera, renderer…)
 *                    and RenderCallbackContext (render loop registration)
 *     └─ SceneContent  ← MUST be a separate child component so React
 *                         context propagates before hooks run
 *          └─ FilamentView  ← the Metal/GL surface
 *               ├─ Camera        ← uses RenderCallbackContext + FilamentContext
 *               ├─ DefaultLight  ← uses FilamentContext (engine.setIndirectLight)
 *               └─ Model         ← uses FilamentContext (renderableManager, scene)
 *
 * DefaultLight sources its IBL from the pod-bundled RNF_default_env_ibl.ktx
 * (declared as s.resources in react-native-filament.podspec).
 */

import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {
  Camera,
  DefaultLight,
  FilamentScene,
  FilamentView,
  Model,
} from 'react-native-filament';

// Metro resolves this via the 'glb' assetExt added in metro.config.js.
// The file lives at assets/models/avatar/avatar_base_male.glb.
const MODEL_SOURCE = require('../../assets/models/avatar/avatar_base_male.glb');

/**
 * SceneContent must be a separate component from FilamentScene so that
 * the FilamentContext and RenderCallbackContext are available when the
 * hooks inside Camera, DefaultLight, and Model execute.
 */
function SceneContent() {
  return (
    <FilamentView style={styles.filamentView}>
      {/* Camera default: position [0,0,8], target [0,0,0] — box is visible */}
      <Camera />
      {/* DefaultLight = IBL from RNF_default_env_ibl.ktx + directional 10k lux */}
      <DefaultLight />
      {/* Model loads the GLB binary via useModel internally */}
      <Model source={MODEL_SOURCE} />
    </FilamentView>
  );
}

export function FilamentSpikeScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>Filament Spike — Milestone 1</Text>

      {/*
       * FilamentScene initialises the Filament engine and provides:
       *   - FilamentContext.Provider  (engine, camera, renderer, scene…)
       *   - RenderCallbackContext.RenderContextProvider (render loop)
       * Without this wrapper, Camera/DefaultLight/Model all throw at runtime.
       */}
      {/* FilamentScene does not accept a style prop — size it via a View wrapper */}
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
  label: {
    color: '#ffffff',
    textAlign: 'center',
    paddingVertical: 14,
    fontSize: 15,
    letterSpacing: 0.4,
  },
  scene: {
    flex: 1,
  },
  filamentView: {
    flex: 1,
  },
});
