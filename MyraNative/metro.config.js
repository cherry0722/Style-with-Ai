const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

/**
 * Extend assetExts with file types needed by react-native-filament.
 * We spread defaultConfig.resolver.assetExts to avoid overwriting
 * existing extensions (png, jpg, ttf, etc.).
 *
 * resolveRequest aliases @expo/vector-icons to a local stub so that
 * expo-font / expo-asset are never pulled into the Metro bundle.
 * TODO: remove alias once icons are migrated to react-native-vector-icons.
 */
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
    resolveRequest: (context, moduleName, _platform) => {
      if (moduleName === '@expo/vector-icons') {
        return {
          filePath: path.resolve(__dirname, 'src/stubs/vector-icons.js'),
          type: 'sourceFile',
        };
      }
      return context.resolveRequest(context, moduleName, _platform);
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
