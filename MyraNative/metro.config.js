const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

/**
 * Extend assetExts with file types needed by react-native-filament.
 * We spread defaultConfig.resolver.assetExts to avoid overwriting
 * existing extensions (png, jpg, ttf, etc.).
 */
const config = {
  resolver: {
    assetExts: [
      ...defaultConfig.resolver.assetExts,
      'glb',   // GL Transmission Format Binary — 3D models
      'gltf',  // GL Transmission Format JSON — 3D models
      'bin',   // Binary buffers referenced by .gltf files
      'ktx',   // Khronos Texture — used by Filament IBL/skybox
      'filamat', // Filament material binary
    ],
  },
};

module.exports = mergeConfig(defaultConfig, config);
