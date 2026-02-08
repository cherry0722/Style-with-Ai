/**
 * AsyncStorage-backed persist storage for Zustand (Expo Go safe).
 * Catches errors so persistence failures do not crash; no repeated warnings.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

let warned = false;

async function safeGetItem(name: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(name);
  } catch (_) {
    if (!warned) {
      warned = true;
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[persistStorage] AsyncStorage unavailable, using in-memory only');
      }
    }
    return null;
  }
}

async function safeSetItem(name: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(name, value);
  } catch (_) {
    if (!warned) {
      warned = true;
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[persistStorage] AsyncStorage unavailable, using in-memory only');
      }
    }
  }
}

async function safeRemoveItem(name: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(name);
  } catch (_) {}
}

export const persistStorage = {
  getItem: safeGetItem,
  setItem: safeSetItem,
  removeItem: safeRemoveItem,
};
