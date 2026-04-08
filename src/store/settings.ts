import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings } from '../types';

interface SettingsStore extends AppSettings {
  calendarConnected: boolean;
  toggleTemperatureUnit: () => void;
  toggleNotifications: () => void;
  toggleScreenTimeTracking: () => void;
  toggleDarkMode: () => void;
  setLocationPermission: (granted: boolean) => void;
  setPreferredLocation: (location: string) => void;
  setCalendarConnected: (value: boolean) => Promise<void>;
  hydrate: () => Promise<void>;
}

const defaultSettings: AppSettings = {
  temperatureUnit: 'fahrenheit',
  notificationsEnabled: true,
  screenTimeTrackingEnabled: false,
  locationPermissionGranted: false,
  preferredLocation: '',
  darkMode: false,
};

export const useSettings = create<SettingsStore>((set) => ({
  ...defaultSettings,
  calendarConnected: false,

  hydrate: async () => {
    try {
      const value = await AsyncStorage.getItem('settings.screenTimeTracking');
      if (value !== null) {
        set({ screenTimeTrackingEnabled: JSON.parse(value) });
      }
      const storedUnit = await AsyncStorage.getItem('settings.temperatureUnit');
      if (storedUnit === 'celsius' || storedUnit === 'fahrenheit') {
        set({ temperatureUnit: storedUnit });
      }
      const storedCal = await AsyncStorage.getItem('settings.calendarConnected');
      if (storedCal !== null) {
        set({ calendarConnected: storedCal === 'true' });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  },

  toggleTemperatureUnit: () => {
    set((state) => {
      const next = state.temperatureUnit === 'celsius' ? 'fahrenheit' : 'celsius';
      AsyncStorage.setItem('settings.temperatureUnit', JSON.stringify(next));
      return { temperatureUnit: next };
    });
  },

  toggleNotifications: () => {
    set((state) => {
      const next = !state.notificationsEnabled;
      AsyncStorage.setItem('settings.notifications', JSON.stringify(next));
      return { notificationsEnabled: next };
    });
  },

  toggleScreenTimeTracking: () => {
    set((state) => {
      const next = !state.screenTimeTrackingEnabled;
      AsyncStorage.setItem('settings.screenTimeTracking', JSON.stringify(next));
      return { screenTimeTrackingEnabled: next };
    });
  },

  toggleDarkMode: () => {
    set((state) => ({ darkMode: !state.darkMode }));
  },

  setLocationPermission: (granted: boolean) => {
    AsyncStorage.setItem('settings.locationPermission', JSON.stringify(granted));
    set({ locationPermissionGranted: granted });
  },

  setPreferredLocation: (location: string) => {
    AsyncStorage.setItem('settings.preferredLocation', JSON.stringify(location));
    set({ preferredLocation: location });
  },

  setCalendarConnected: async (value: boolean) => {
    set({ calendarConnected: value });
    await AsyncStorage.setItem('settings.calendarConnected', String(value));
  },
}));
