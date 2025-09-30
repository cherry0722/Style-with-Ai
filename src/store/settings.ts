import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppSettings } from '../types';

interface SettingsState extends AppSettings {
  darkMode: boolean;
  updateSettings: (settings: Partial<AppSettings>) => void;
  toggleTemperatureUnit: () => void;
  toggleNotifications: () => void;
  toggleDarkMode: () => void;
  setLocationPermission: (granted: boolean) => void;
  setPreferredLocation: (location: string) => void;
}

const defaultSettings: AppSettings = {
  temperatureUnit: 'fahrenheit',
  notificationsEnabled: true,
  locationPermissionGranted: false,
  lastWeatherUpdate: undefined,
  preferredLocation: undefined,
};

const defaultState = {
  ...defaultSettings,
  darkMode: false,
};

export const useSettings = create<SettingsState>()((set, get) => ({
  ...defaultState,
  
  updateSettings: (newSettings) => {
    set((state) => ({
      ...state,
      ...newSettings,
    }));
  },
  
  toggleTemperatureUnit: () => {
    set((state) => ({
      temperatureUnit: state.temperatureUnit === 'celsius' ? 'fahrenheit' : 'celsius',
    }));
  },
  
  toggleNotifications: () => {
    set((state) => ({
      notificationsEnabled: !state.notificationsEnabled,
    }));
  },
  
  toggleDarkMode: () => {
    set((state) => ({
      darkMode: !state.darkMode,
    }));
  },
  
  setLocationPermission: (granted) => {
    set({ locationPermissionGranted: granted });
  },
  
  setPreferredLocation: (location) => {
    set({ preferredLocation: location });
  },
}));
