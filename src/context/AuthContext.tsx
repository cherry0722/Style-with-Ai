import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from "react";
import type { UserAuth } from "../types";
import client from "../api/client";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setOn401 } from "../api/on401";
import { setTokenGetter } from "../api/tokenGetter";
import { useCloset } from "../store/closet";
import { useCurrentOutfitStore } from "../store/useCurrentOutfitStore";
import { useCalendar } from "../store/calendar";
import { useNotifications } from "../store/notifications";
import { useFavorites } from "../store/favorites";

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
    setToken(null);
    setUser(null);
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
    const res = await client.post("/api/login", { email, password });
    const { user: u, token: t } = res.data;
    if (!t) throw new Error('No token in response');
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, t);
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem(TOKEN_STORAGE_KEY, t); } catch (_) {}
    }
    setToken(t);
    const userData = { id: u._id, email: u.email, username: u.username, phone: u.phone };
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
    setUser(userData);
  }

  async function signup(email: string, password: string, username?: string, phone?: string, image?: string) {
    await client.post("/api/users", { email, password, username: username || undefined, phone: phone || undefined, image });
    await login(email, password);
  }

  async function logout() {
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
