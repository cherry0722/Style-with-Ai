import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import type { UserAuth } from "../types";
import client from "../api/client";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCloset } from "../store/closet";
import { useCurrentOutfitStore } from "../store/useCurrentOutfitStore";
import { useCalendar } from "../store/calendar";
import { useNotifications } from "../store/notifications";
import { useFavorites } from "../store/favorites";

interface AuthCtx {
  user: UserAuth | null;
  loading: boolean;
  setUser: (u: UserAuth | null) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username?: string, phone?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  loginWithPhone: (phone: string) => Promise<void>;
  logout: () => void;
  updateProfile?: (patch: Partial<UserAuth>) => void; // optional
}

const Ctx = createContext<AuthCtx | null>(null);

const USER_STORAGE_KEY = 'myra_user';
const TOKEN_STORAGE_KEY = 'token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserAuth | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize: Load user and token from AsyncStorage on mount
  useEffect(() => {
    async function initializeAuth() {
      try {
        // Try to restore user data from AsyncStorage
        const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
        const storedToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
        
        if (storedUser && storedToken) {
          try {
            const userData = JSON.parse(storedUser);
            setUser(userData);
            console.log("Restored user from storage:", userData);
          } catch (e) {
            console.error("Failed to parse stored user data:", e);
            // Clear invalid data
            await AsyncStorage.removeItem(USER_STORAGE_KEY);
            await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        setLoading(false);
      }
    }

    initializeAuth();
  }, []);

  // Login with email/password
  async function login(email: string, password: string) {
    try {
      const res = await client.post("/api/login", { email, password });
      const { user, token } = res.data;

      // Store token
      if (token) {
        await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(TOKEN_STORAGE_KEY, token);
        }
      }

      const userData = {
        id: user._id,
        email: user.email,
        username: user.username,
        phone: user.phone,
      };
      
      // Store user data in AsyncStorage for persistence across app restarts
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
      
      setUser(userData);
      console.log("Login successful! User set:", userData);
    } catch (err: any) {
      console.error("Login failed:", err.data || err.message);
      throw new Error(err.data?.message || err.message || "Invalid credentials");
    }
  }

  // Signup with email, password, username, phone
  async function signup(email: string, password: string, username?: string, phone?: string, image?: string) {
    // Debug logging (development only) - sanitize password
    if (typeof _DEV_ !== 'undefined' && _DEV_) {
      const sanitizedPayload = { email, username, phone, image: image ? '[provided]' : undefined, password: '[REDACTED]' };
      console.log('[Auth] Signup request payload (sanitized):', sanitizedPayload);
      console.log('[Auth] Calling POST /api/users');
    }

    try {
      // 1) Create the user account
      const res = await client.post("/api/users", {
        email,
        password,
        username,
        phone,
        image,
      });

      // Debug logging (development only)
      if (typeof _DEV_ !== 'undefined' && _DEV_) {
        console.log('[Auth] Signup response:', res.data);
        console.log('[Auth] Signup successful, logging in...');
      }

      // 2) Immediately log in to obtain JWT token and set auth state
      await login(email, password);

      // Do NOT set user/token here directly.
      // Do NOT navigate from signup(), let login() or the caller handle navigation.
    } catch (err: any) {
      // Debug logging (development only)
      if (typeof _DEV_ !== 'undefined' && _DEV_) {
        console.error('[Auth] Signup error:', {
          message: err?.message,
          status: err?.status || err?.response?.status,
          data: err?.data || err?.response?.data,
        });
      }
      
      // Handle network errors
      if (err.message === 'Network Error' || err.message?.includes('Network') || err.message?.includes('timeout')) {
        throw new Error('Cannot connect to server. Make sure the backend is running and the API URL is correct.');
      }
      
      // Handle API errors
      const errorMessage = err.data?.message || err.response?.data?.message || err.message || "Signup failed";
      throw new Error(errorMessage);
    }
  }

  async function loginWithGoogle() {
    setUser({ id: "demo-google", email: "you@gmail.com", username: "You", phone: "" });
  }

  async function loginWithApple() {
    setUser({ id: "demo-apple", email: "you@icloud.com", username: "You", phone: "" });
  }

  async function loginWithPhone(phone: string) {
    setUser({ id: "demo-phone", email: "", username: phone, phone });
  }

  async function logout() {
    // Remove token and user data from storage
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    }
    
    // Reset user-specific Zustand stores
    useCloset.getState().reset();
    useCurrentOutfitStore.getState().reset();
    useCalendar.getState().reset();
    useNotifications.getState().reset();
    useFavorites.getState().reset();
    
    setUser(null);
  }

  const updateProfile = async (patch: Partial<UserAuth>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const nextUser = { ...prev, ...patch };
      // Persist updated user to AsyncStorage (and localStorage for web)
      AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser)).catch(
        (err) => {
          console.error("[Auth] Failed to persist updated user profile:", err);
        }
      );
      if (typeof localStorage !== "undefined") {
        try {
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(nextUser));
        } catch (err) {
          console.error(
            "[Auth] Failed to persist updated user profile to localStorage:",
            err
          );
        }
      }
      return nextUser;
    });
  };

  return (
    <Ctx.Provider
      value={{
        user,
        loading,
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
