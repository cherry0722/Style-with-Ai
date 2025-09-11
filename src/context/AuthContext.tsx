import React, { createContext, useContext, useState, ReactNode } from "react";
import type { UserAuth, UserProfile } from "../types";

interface AuthCtx {
  user: UserAuth | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, profile?: UserProfile) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  loginWithPhone: (phone: string) => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => void;
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

  async function login(email: string, _password: string) {
    setUser({ id: "demo", email, displayName: nameFromEmail(email), profile: {} });
  }

  async function signup(email: string, _password: string, profile?: UserProfile) {
    setUser({
      id: "demo",
      email,
      displayName: profile?.preferredName || nameFromEmail(email),
      profile: { ...profile },
    });
  }

  async function loginWithGoogle() {
    setUser({
      id: "demo-google",
      email: "you@gmail.com",
      displayName: "You",
      profile: {},
    });
  }

  async function loginWithApple() {
    setUser({
      id: "demo-apple",
      email: "you@icloud.com",
      displayName: "You",
      profile: {},
    });
  }

  async function loginWithPhone(phone: string) {
    setUser({
      id: "demo-phone",
      phone,
      displayName: phone,
      profile: {},
    });
  }

  function updateProfile(patch: Partial<UserProfile>) {
    setUser((u) => (u ? { ...u, profile: { ...(u.profile || {}), ...patch } } : u));
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
        updateProfile,
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
