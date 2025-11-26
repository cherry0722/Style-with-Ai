import React, { createContext, useContext, useState, ReactNode } from "react";
import type { UserAuth } from "../types";
import client from "../api/client";
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthCtx {
  user: UserAuth | null;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserAuth | null>(null);

  // Login with email/password
  async function login(email: string, password: string) {
    try {
      const res = await client.post("/api/login", { email, password });
      const { user, token } = res.data;

      // Store token
      if (token) {
        await AsyncStorage.setItem('token', token);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('token', token);
        }
      }

      const userData = {
        id: user._id,
        email: user.email,
        username: user.username,
        phone: user.phone,
      };
      
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
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      const sanitizedPayload = { email, username, phone, image, password: '[REDACTED]' };
      console.log('[Auth] Signup request payload (sanitized):', sanitizedPayload);
      console.log('[Auth] Calling POST /api/users');
    }

    try {
      const res = await client.post("/api/users", {
        email,
        password,
        username,
        phone,
        image,
      });

      const { user } = res.data;

      // Debug logging (development only)
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[Auth] Signup response:', { 
          userId: user._id, 
          email: user.email, 
          username: user.username 
        });
      }

      // Note: Signup doesn't return a token, user needs to login after signup
      // If you want auto-login after signup, you can call login() here

      setUser({
        id: user._id,
        email: user.email,
        username: user.username,
        phone: user.phone,
      });

      console.log("Signup successful!");
    } catch (err: any) {
      // Debug logging (development only)
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.error('[Auth] Signup error:', {
          message: err?.message,
          status: err?.status,
          data: err?.data,
          fullError: err,
        });
      }
      
      // Handle network errors
      if (err.message === 'Network Error' || err.message?.includes('Network') || err.message?.includes('timeout')) {
        throw new Error('Cannot connect to server. Make sure the backend is running and the API URL is correct.');
      }
      
      // Handle API errors
      const errorMessage = err.data?.message || err.message || "Signup failed";
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
    // Remove token from storage
    await AsyncStorage.removeItem('token');
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('token');
    }
    setUser(null);
  }

  const updateProfile = (patch: Partial<UserAuth>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : null));
  };

  return (
    <Ctx.Provider
      value={{
        user,
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
