import React, { createContext, useContext, useState, ReactNode } from "react";
import type { UserAuth } from "../types";
import client from "../api/client";
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthCtx {
  user: UserAuth | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username?: string, phone?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  loginWithPhone: (phone: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

function nameFromEmail(email?: string) {
  if (!email) return undefined;
  const left = email.split("@")[0] || "";
  return left.charAt(0).toUpperCase() + left.slice(1);
}

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
    try {
      const res = await client.post("/api/users", {
        email,
        password,
        username,
        phone,
        image,
      });

      const { user } = res.data;

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
      console.error("Signup failed:", err);
      
      // Handle network errors
      if (err.message === 'Network Error' || err.message?.includes('Network')) {
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

  return (
    <Ctx.Provider
      value={{
        user,
        login,
        signup,
        loginWithGoogle,
        loginWithApple,
        loginWithPhone,
        logout,
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
