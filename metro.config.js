const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    assetExts: [
      ...defaultConfig.resolver.assetExts,
      'glb',     // GL Transmission Format Binary — 3D models
      'gltf',    // GL Transmission Format JSON — 3D models
      'bin',     // Binary buffers referenced by .gltf files
      'ktx',     // Khronos Texture — used by Filament IBL/skybox
      'filamat', // Filament material binary
    ],
  },
};

module.exports = mergeConfig(defaultConfig, config);
