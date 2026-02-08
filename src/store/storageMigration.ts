/**
 * One-time migration to remove non-string / invalid JSON values for persist keys.
 * Bump STORAGE_VERSION to 2 so migration runs once per install.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_VERSION_KEY = 'myra-storage-version';
const STORAGE_VERSION = '2';
const PERSIST_KEYS = ['myra-calendar', 'myra-notifications'] as const;

function isValidJsonString(str: string): boolean {
  if (str === '' || str === '[object Object]') return false;
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

export async function runStorageMigration(): Promise<void> {
  try {
    const version = await AsyncStorage.getItem(STORAGE_VERSION_KEY);
    if (version === STORAGE_VERSION) return;

    for (const key of PERSIST_KEYS) {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw == null) continue;
        if (typeof raw !== 'string') {
          await AsyncStorage.removeItem(key);
          continue;
        }
        if (raw === '[object Object]' || !isValidJsonString(raw)) {
          await AsyncStorage.removeItem(key);
        }
      } catch (_) {
        await AsyncStorage.removeItem(key).catch(() => {});
      }
    }

    await AsyncStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
  } catch (_) {}
}
