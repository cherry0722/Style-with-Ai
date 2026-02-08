/**
 * AsyncStorage-backed Zustand persist adapter (Expo Go safe).
 * - setItem ALWAYS writes a string (JSON.stringify).
 * - getItem returns string or null; invalid/corrupt data is removed and returns null.
 * - Never throws; single dev warning if storage fails.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

let warned = false;

function isValidJsonString(str: string): boolean {
  if (str === '' || str === '[object Object]') return false;
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

async function safeGetItem(name: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(name);
    if (raw == null) return null;
    if (typeof raw !== 'string') {
      await AsyncStorage.removeItem(name);
      if (!warned && typeof __DEV__ !== 'undefined' && __DEV__) {
        warned = true;
        console.warn('[persistStorage] Non-string value removed for key:', name);
      }
      return null;
    }
    if (!isValidJsonString(raw)) {
      await AsyncStorage.removeItem(name);
      if (!warned && typeof __DEV__ !== 'undefined' && __DEV__) {
        warned = true;
        console.warn('[persistStorage] Invalid JSON value removed for key:', name);
      }
      return null;
    }
    return raw;
  } catch (_) {
    if (!warned && typeof __DEV__ !== 'undefined' && __DEV__) {
      warned = true;
      console.warn('[persistStorage] AsyncStorage unavailable, using in-memory only');
    }
    return null;
  }
}

async function safeSetItem(name: string, value: unknown): Promise<void> {
  try {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    await AsyncStorage.setItem(name, str);
  } catch (_) {
    if (!warned && typeof __DEV__ !== 'undefined' && __DEV__) {
      warned = true;
      console.warn('[persistStorage] AsyncStorage unavailable, using in-memory only');
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
