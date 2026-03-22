/**
 * @expo/vector-icons compatibility shim for bare React Native.
 *
 * All screens import { Ionicons } from '@expo/vector-icons'.
 * metro.config.js aliases that module here so that @expo/vector-icons'
 * expo-font dependency is never executed.
 *
 * This shim re-exports react-native-vector-icons components so icons
 * render via natively linked TTF fonts (linked by react-native-asset).
 */

export { default as Ionicons } from 'react-native-vector-icons/Ionicons';
export { default as MaterialIcons } from 'react-native-vector-icons/MaterialIcons';
export { default as FontAwesome } from 'react-native-vector-icons/FontAwesome';
export { default as Feather } from 'react-native-vector-icons/Feather';
export { default as AntDesign } from 'react-native-vector-icons/AntDesign';
export { default as Entypo } from 'react-native-vector-icons/Entypo';
export { default as MaterialCommunityIcons } from 'react-native-vector-icons/MaterialCommunityIcons';
