/**
 * Auth API — v2 Phase 1 endpoints.
 * POST /api/auth/signup, /api/auth/login, /api/auth/logout.
 * Response shape: { user, accessToken } for signup/login.
 */
import client from './client';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
}

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
}

export interface SignupPayload {
  username: string;
  email: string;
  password: string;
}

export interface SignupResponse {
  user: AuthUser;
  accessToken: string;
}

const AUTH_LOGIN_PATH = '/api/auth/login';
const AUTH_SIGNUP_PATH = '/api/auth/signup';
const AUTH_LOGOUT_PATH = '/api/auth/logout';

/** POST /api/auth/login — returns { user, accessToken }. */
export async function login(email: string, password: string): Promise<LoginResponse> {
  if (__DEV__) console.log('[Auth API] POST', AUTH_LOGIN_PATH);
  const res = await client.post<LoginResponse>(AUTH_LOGIN_PATH, { email, password });
  return res.data;
}

/** POST /api/auth/signup — returns { user, accessToken }. */
export async function signup(payload: SignupPayload): Promise<SignupResponse> {
  if (__DEV__) console.log('[Auth API] POST', AUTH_SIGNUP_PATH);
  const res = await client.post<SignupResponse>(AUTH_SIGNUP_PATH, payload);
  return res.data;
}

/** POST /api/auth/logout — auth required. */
export async function logout(): Promise<{ ok: boolean }> {
  if (__DEV__) console.log('[Auth API] POST', AUTH_LOGOUT_PATH);
  const res = await client.post<{ ok: boolean }>(AUTH_LOGOUT_PATH);
  return res.data;
}
