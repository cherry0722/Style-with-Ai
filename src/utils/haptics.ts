/**
 * Haptic feedback utility — MyraNative version.
 * Replaces expo-haptics with react-native-haptic-feedback.
 * API surface is identical to the Expo app's src/utils/haptics.ts so all
 * call sites (SettingsScreen, etc.) work without changes.
 */
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const OPTIONS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
} as const;

export const hapticFeedback = {
  light:     () => ReactNativeHapticFeedback.trigger('impactLight',         OPTIONS),
  medium:    () => ReactNativeHapticFeedback.trigger('impactMedium',        OPTIONS),
  heavy:     () => ReactNativeHapticFeedback.trigger('impactHeavy',         OPTIONS),
  success:   () => ReactNativeHapticFeedback.trigger('notificationSuccess', OPTIONS),
  warning:   () => ReactNativeHapticFeedback.trigger('notificationWarning', OPTIONS),
  error:     () => ReactNativeHapticFeedback.trigger('notificationError',   OPTIONS),
  selection: () => ReactNativeHapticFeedback.trigger('selection',           OPTIONS),
};
