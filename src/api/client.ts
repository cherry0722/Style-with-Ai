import axios, { AxiosError } from 'axios';
import { API_BASE_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTokenFromAuthSync } from './tokenGetter';
import { callOn401 } from './on401';

async function getToken(): Promise<string | undefined> {
  try {
    const fromAuth = getTokenFromAuthSync();
    if (fromAuth) return fromAuth;
    const token = await AsyncStorage.getItem('token');
    if (token) return token;
    if (typeof localStorage !== 'undefined') {
      return localStorage?.getItem?.('token') ?? undefined;
    }
  } catch (_) {}
  return undefined;
}

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  console.log('[API Client] baseURL =', API_BASE_URL);
}

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

client.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const status = err?.response?.status;
    const data = err?.response?.data as Record<string, unknown> | undefined;
    const url = err?.config?.url ?? '';

    const errBody = data && typeof data === 'object' && data.error && typeof (data as { error?: { message?: string } }).error === 'object'
      ? (data as { error: { message?: string } }).error
      : null;
    const msgFromBody = errBody?.message ?? (data && typeof data === 'object' && 'message' in data ? (data as { message: string }).message : null);

    if (status === 401) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[API Client] Auth failure (401)', { url, status });
      }
      callOn401();
      const cleanMessage = msgFromBody ? String(msgFromBody) : 'Session expired. Please log in again.';
      return Promise.reject({ status: 401, data, message: cleanMessage });
    }

    if (typeof __DEV__ !== 'undefined' && __DEV__ && (status === 400 || status === 401 || status === 403)) {
      console.log('[API Client] Auth/validation failure', { url, status, body: data });
    }

    const cleanMessage = msgFromBody ? String(msgFromBody) : err?.message || (status ? `Request failed with status ${status}` : 'Request failed');

    return Promise.reject({ status: status || undefined, data: data || undefined, message: cleanMessage });
  }
);

export default client;
