module.exports = {
  assets: [
    './assets/models/',
    // Fonts are bundled by CocoaPods via RNVectorIcons.podspec "resources: Fonts/*.ttf".
    // Do NOT add react-native-vector-icons/Fonts/ here — it causes duplicate Copy Bundle
    // Resources entries that break the Xcode build with "Multiple commands produce *.ttf".
  ],
};
