import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from "react";
import type { UserAuth } from "../types";
import * as authApi from "../api/auth";
import { getCurrentUser } from "../api/user";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setOn401 } from "../api/on401";
import { setTokenGetter } from "../api/tokenGetter";
import { useCloset } from "../store/closet";
import { useCurrentOutfitStore } from "../store/useCurrentOutfitStore";
import { useCalendar } from "../store/calendar";
import { useNotifications } from "../store/notifications";
import { useFavorites } from "../store/favorites";
import { useSettings } from "../store/settings";

export type NavigationRef = { current: { reset: (arg: { index: number; routes: { name: string }[] }) => void } | null };

interface AuthCtx {
  user: UserAuth | null;
  token: string | null;
  loading: boolean;
  isRestoring: boolean;
  sessionExpiredMessage: string | null;
  clearSessionMessage: () => void;
  setUser: (u: UserAuth | null) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username?: string, phone?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  loginWithPhone: (phone: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile?: (patch: Partial<UserAuth>) => void;
  refreshUserFromBackend?: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

const USER_STORAGE_KEY = 'myra_user';
const TOKEN_STORAGE_KEY = 'token';

export function AuthProvider({ children, navRef }: { children: ReactNode; navRef?: NavigationRef }) {
  const [user, setUser] = useState<UserAuth | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState<string | null>(null);
  const logoutRef = useRef<() => Promise<void>>(() => Promise.resolve());
  logoutRef.current = async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
      } catch (_) {}
    }
    useCloset.getState().reset();
    useCurrentOutfitStore.getState().reset();
    useCalendar.getState().reset();
    useNotifications.getState().reset();
    useFavorites.getState().reset();
  };

  useEffect(() => {
    let cancelled = false;
    async function initializeAuth() {
      try {
        const [storedUser, storedToken] = await Promise.all([
          AsyncStorage.getItem(USER_STORAGE_KEY),
          AsyncStorage.getItem(TOKEN_STORAGE_KEY),
        ]);
        if (cancelled) return;
        if (storedToken) setToken(storedToken);
        if (storedUser && storedToken) {
          try {
            const userData = JSON.parse(storedUser);
            setUser(userData);
          } catch (_) {
            await AsyncStorage.removeItem(USER_STORAGE_KEY);
            await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
            setToken(null);
          }
        }
        if (storedToken && !cancelled) {
          try {
            const me = await getCurrentUser();
            if (cancelled) return;
            const normalized: UserAuth = {
              id: (me._id as string)?.toString?.() ?? me.id as string,
              email: me.email as string,
              username: me.username as string,
              phone: (me.phone as string) ?? '',
              image: me.image as string | undefined,
              profile: (me.profile as UserAuth['profile']) ?? undefined,
            };
            setUser(normalized);
            await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(normalized));

            const s = (me as any).settings;
            if (s && typeof s === "object") {
              useSettings.setState((prev) => ({
                ...prev,
                temperatureUnit:
                  s.temperatureUnit === "celsius" || s.temperatureUnit === "fahrenheit"
                    ? s.temperatureUnit
                    : prev.temperatureUnit,
                notificationsEnabled:
                  typeof s.notificationsEnabled === "boolean"
                    ? s.notificationsEnabled
                    : prev.notificationsEnabled,
              }));
            }
            const p = (me as any).permissions;
            if (p && typeof p === "object") {
              useSettings.setState((prev) => ({
                ...prev,
                cameraEnabled: typeof p.camera === "boolean" ? p.camera : prev.cameraEnabled,
                photosEnabled: typeof p.photos === "boolean" ? p.photos : prev.photosEnabled,
                locationEnabled: typeof p.location === "boolean" ? p.location : prev.locationEnabled,
                microphoneEnabled: typeof p.microphone === "boolean" ? p.microphone : prev.microphoneEnabled,
                notificationsEnabled: typeof p.notifications === "boolean" ? p.notifications : prev.notificationsEnabled,
              }));
            }
          } catch (_) {
            if (!cancelled && storedUser) {
              try {
                const userData = JSON.parse(storedUser);
                setUser(userData);
              } catch (__) {}
            }
          }
        }
      } catch (_) {
        if (!cancelled) setToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    initializeAuth();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setTokenGetter(() => token);
    return () => setTokenGetter(null);
  }, [token]);

  useEffect(() => {
    const handle401 = () => {
      setSessionExpiredMessage('Session expired. Please log in again.');
      logoutRef.current().then(() => {
        if (navRef?.current?.reset) {
          navRef.current.reset({ index: 0, routes: [{ name: 'Auth' }] });
        }
      });
    };
    setOn401(handle401);
    return () => setOn401(null);
  }, [navRef]);

  async function login(email: string, password: string) {
    const { user: u, accessToken: t } = await authApi.login(email, password);
    if (!t) throw new Error('No accessToken in response');
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, t);
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem(TOKEN_STORAGE_KEY, t); } catch (_) {}
    }
    setToken(t);
    const me = await getCurrentUser();
const userData: UserAuth = {
  id: (me._id as string)?.toString?.() ?? (me.id as string),
  email: me.email as string,
  username: me.username as string,
  phone: (me.phone as string) ?? '',
  image: me.image as string | undefined,
  profile: (me.profile as UserAuth['profile']) ?? undefined,
};
await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
setUser(userData);
  }

  async function signup(email: string, password: string, username?: string, phone?: string) {
    const { user: u, accessToken: t } = await authApi.signup({
      username: username ?? email.split('@')[0],
      email,
      password,
    });
    if (!t) throw new Error('No accessToken in response');
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, t);
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem(TOKEN_STORAGE_KEY, t); } catch (_) {}
    }
    setToken(t);
    const userData: UserAuth = { id: u.id, email: u.email, username: u.username ?? '', phone: phone ?? '' };
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
    setUser(userData);
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch (_) {}
    await logoutRef.current();
  }

  const clearSessionMessage = () => setSessionExpiredMessage(null);

  async function loginWithGoogle() {
    setUser({ id: "demo-google", email: "you@gmail.com", username: "You", phone: "" });
  }
  async function loginWithApple() {
    setUser({ id: "demo-apple", email: "you@icloud.com", username: "You", phone: "" });
  }
  async function loginWithPhone(phone: string) {
    setUser({ id: "demo-phone", email: "", username: phone, phone });
  }

  const updateProfile = async (patch: Partial<UserAuth>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const refreshUserFromBackend = async () => {
    try {
      const me = await getCurrentUser();
      const normalized: UserAuth = {
        id: (me._id as string)?.toString?.() ?? (me.id as string),
        email: me.email as string,
        username: me.username as string,
        phone: (me.phone as string) ?? '',
        image: me.image as string | undefined,
        profile: (me.profile as UserAuth['profile']) ?? undefined,
      };
      setUser(normalized);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(normalized));
      if (typeof localStorage !== 'undefined') {
        try { localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(normalized)); } catch (__) {}
      }
      const s = (me as any).settings;
      if (s && typeof s === "object") {
        useSettings.setState((prev) => ({
          ...prev,
          temperatureUnit:
            s.temperatureUnit === "celsius" || s.temperatureUnit === "fahrenheit"
              ? s.temperatureUnit
              : prev.temperatureUnit,
          notificationsEnabled:
            typeof s.notificationsEnabled === "boolean"
              ? s.notificationsEnabled
              : prev.notificationsEnabled,
        }));
      }
      const p = (me as any).permissions;
      if (p && typeof p === "object") {
        useSettings.setState((prev) => ({
          ...prev,
          cameraEnabled: typeof p.camera === "boolean" ? p.camera : prev.cameraEnabled,
          photosEnabled: typeof p.photos === "boolean" ? p.photos : prev.photosEnabled,
          locationEnabled: typeof p.location === "boolean" ? p.location : prev.locationEnabled,
          microphoneEnabled: typeof p.microphone === "boolean" ? p.microphone : prev.microphoneEnabled,
          notificationsEnabled: typeof p.notifications === "boolean" ? p.notifications : prev.notificationsEnabled,
        }));
      }
    } catch (_) {}
  };

  return (
    <Ctx.Provider
      value={{
        user,
        token,
        loading,
        isRestoring: loading,
        sessionExpiredMessage,
        clearSessionMessage,
        setUser,
        login,
        signup,
        loginWithGoogle,
        loginWithApple,
        loginWithPhone,
        logout,
        updateProfile,
        refreshUserFromBackend,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
