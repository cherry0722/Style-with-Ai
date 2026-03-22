import { create } from 'zustand';
import { AppSettings } from '../types';
import { getUserPermissions } from '../api/user';
import { Camera } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Audio } from "expo-av";


interface SettingsState extends AppSettings {
  darkMode: boolean;
  updateSettings: (settings: Partial<AppSettings>) => void;
  toggleTemperatureUnit: () => void;
  toggleNotifications: () => void;
  toggleDarkMode: () => void;
  setLocationPermission: (granted: boolean) => void;
  setCameraPermission: (granted: boolean) => void;
  setPhotosPermission: (granted: boolean) => void;
  setMicrophonePermission: (granted: boolean) => void;
  setPreferredLocation: (location: string) => void;
  syncPermissions: () => Promise<void>;
  osStatus: Record<string, boolean>;
  refreshOSPermissions: () => Promise<void>;
  setTextSize: (size: 'small' | 'medium' | 'large') => void;
  addTimeSpent: (ms: number) => void;
}

const defaultSettings: AppSettings = {
  temperatureUnit: 'fahrenheit',
  notificationsEnabled: true,
  locationPermissionGranted: false,
  cameraEnabled: false,
  photosEnabled: false,
  locationEnabled: false,
  microphoneEnabled: false,
  lastWeatherUpdate: undefined,
  preferredLocation: undefined,
  textSize: 'medium',
  totalTimeSpentMs: 0,
};

const defaultOSStatus = {
  camera: false,
  photos: false,
  location: false,
  notifications: false,
  microphone: false,
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
    set({ locationPermissionGranted: granted, locationEnabled: granted });
  },
  
  setCameraPermission: (granted) => {
    set({ cameraEnabled: granted });
  },
  
  setPhotosPermission: (granted) => {
    set({ photosEnabled: granted });
  },
  
  setMicrophonePermission: (granted) => {
    set({ microphoneEnabled: granted });
  },
  
  setPreferredLocation: (location) => {
    set({ preferredLocation: location });
  },

  setTextSize: (size) => {
    set({ textSize: size });
  },

  addTimeSpent: (ms) => {
    set((state) => ({ totalTimeSpentMs: (state.totalTimeSpentMs ?? 0) + ms }));
  },
  
  syncPermissions: async () => {
    try {
      const perms = await getUserPermissions();
      set({
        cameraEnabled: !!perms.camera,
        photosEnabled: !!perms.photos,
        locationEnabled: !!perms.location,
        notificationsEnabled: !!perms.notifications,
        microphoneEnabled: !!perms.microphone,
      });
    } catch (err) {
      console.error('Failed to sync permissions:', err);
    }
  },

  osStatus: defaultOSStatus,

  refreshOSPermissions: async () => {
    try {
      const [
        cameraStatus,
        photosStatus,
        locationStatus,
        notificationsStatus,
        microphoneStatus,
      ] = await Promise.all([
        Camera.getCameraPermissionsAsync(),
        MediaLibrary.getPermissionsAsync(),
        Location.getForegroundPermissionsAsync(),
        Notifications.getPermissionsAsync(),
        Audio.getPermissionsAsync(),
      ]);

      set({
        osStatus: {
          camera: cameraStatus.status === "granted",
          photos: photosStatus.status === "granted",
          location: locationStatus.status === "granted",
          notifications: notificationsStatus.status === "granted",
          microphone: microphoneStatus.status === "granted",
        },
      });
    } catch (err) {
      console.error('Failed to refresh OS permissions:', err);
    }
  },
}));
