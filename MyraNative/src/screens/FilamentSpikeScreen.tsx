/**
 * FilamentSpikeScreen — Milestone 1
 *
 * Minimal proof-of-concept: loads assets/models/box.glb and renders it
 * using react-native-filament. No MYRA business logic.
 *
 * Confirmed component names from node_modules/react-native-filament/src/index.tsx:
 *   FilamentView, Model, Camera, DefaultLight
 *
 * DefaultLight internally uses:
 *   - EnvironmentalLight sourced from the pod-bundled RNF_default_env_ibl.ktx
 *   - A directional light at 10,000 lux / 6500 K
 */

import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {Camera, DefaultLight, FilamentView, Model} from 'react-native-filament';

// Metro resolves this via the 'glb' assetExt added in metro.config.js.
// The file lives at assets/models/box.glb.
const MODEL_SOURCE = require('../../assets/models/box.glb');

export function FilamentSpikeScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.label}>Filament Spike — Milestone 1</Text>

      <FilamentView style={styles.filamentView}>
        {/*
         * Camera: default position [0,0,8] looking at origin.
         * The Box GLB is a unit cube at the origin — visible at this distance.
         */}
        <Camera />

        {/*
         * DefaultLight: pods-bundled IBL (RNF_default_env_ibl.ktx)
         * + directional light. Required for the model to be visible.
         */}
        <DefaultLight />

        {/*
         * Model: loads the .glb binary via the useModel hook internally.
         * castShadow / receiveShadow are false by default.
         */}
        <Model source={MODEL_SOURCE} />
      </FilamentView>
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
  filamentView: {
    flex: 1,
  },
});
