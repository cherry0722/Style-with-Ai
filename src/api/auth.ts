/**
 * Auth API — login and signup.
 * All requests use the shared client (BASE_URL from config) with JWT attached when present.
 */
import client from './client';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    _id: string;
    email: string;
    username?: string;
    phone?: string;
    image?: string;
  };
}

export interface SignupPayload {
  email: string;
  password: string;
  username?: string;
  phone?: string;
}

/** POST /api/login — returns { token, user }. */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await client.post<LoginResponse>('/api/login', { email, password });
  return res.data;
}

/** POST /api/users — signup; then caller typically calls login to get token. */
export async function signup(payload: SignupPayload): Promise<{ message?: string }> {
  const res = await client.post('/api/users', payload);
  return res.data;
}
