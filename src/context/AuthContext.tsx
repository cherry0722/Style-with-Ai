import React, { createContext, useContext, useState, ReactNode } from "react";
import type { UserAuth } from "../types";
import axios from "axios";

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
      const res = await axios.post("https://30f492a92c14.ngrok-free.app/api/login", { email, password });
      const { user } = res.data;

      setUser({
        id: user._id,
        email: user.email,
        username: user.username,
        phone: user.phone,
      });

      console.log("Login successful!");
    } catch (err: any) {
      console.error("Login failed:", err.response?.data || err.message);
      throw new Error(err.response?.data?.message || "Invalid credentials");
    }
  }

  // Signup with email, password, username, phone
  async function signup(email: string, password: string, username?: string, phone?: string) {
    try {
      const res = await axios.post("https://30f492a92c14.ngrok-free.app/api/users", {
        email,
        password,
        username,
        phone,
      });

      const { user } = res.data;

      setUser({
        id: user._id,
        email: user.email,
        username: user.username,
        phone: user.phone,
      });

      console.log("Signup successful!");
    } catch (err: any) {
      console.error("Signup failed:", err.response?.data || err.message);
      throw new Error(err.response?.data?.message || "Signup failed");
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

  function logout() {
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
