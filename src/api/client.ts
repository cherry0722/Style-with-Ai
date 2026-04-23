import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { getTokenFromAuthSync } from './tokenGetter';
import { callOn401 } from './on401';

// Re-export so any file that does `import { API_BASE_URL } from './client'` still works
export { API_BASE_URL };

async function getToken(): Promise<string | undefined> {
  try {
    const fromAuth = getTokenFromAuthSync();
    if (fromAuth) return fromAuth;
    const token = await AsyncStorage.getItem('token');
    if (token) return token;
  } catch (_) {}
  return undefined;
}

if (__DEV__) {
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
    const fullUrl = err?.config?.baseURL
      ? `${err.config.baseURL.replace(/\/$/, '')}/${url.replace(/^\//, '')}`
      : url;

    // Network-level failures (no response at all — timeout, refused, unreachable)
    if (!err.response && __DEV__) {
      console.warn('[API Client] Network failure — no response received', {
        code: err.code,          // ERR_NETWORK, ETIMEDOUT, ECONNREFUSED, etc.
        message: err.message,
        fullUrl,
      });
    }

    const errBody =
      data && typeof data === 'object' && data.error && typeof (data as { error?: { message?: string } }).error === 'object'
        ? (data as { error: { message?: string } }).error
        : null;
    const msgFromBody =
      errBody?.message ??
      (data && typeof data === 'object' && 'message' in data
        ? (data as { message: string }).message
        : null);

    if (status === 401) {
      if (__DEV__) {
        console.log('[API Client] Auth failure (401)', { url, status });
      }

      // A 401 from the credential-check endpoints themselves (login / signup /
      // refresh) is NOT a session-expiration event — the user simply typed
      // the wrong email/password or hit a server-side rate limit. Firing the
      // global on401 handler here would wipe any existing token, show the
      // "Session expired. Please log in again." banner, and navigate to Auth,
      // which then masks the real "Invalid email or password" error on the
      // AuthScreen. Only propagate 401s from *authenticated* endpoints into
      // the session-expired pipeline.
      const isCredentialEndpoint =
        url.includes('/api/auth/login') ||
        url.includes('/api/auth/signup') ||
        url.includes('/api/auth/refresh');

      if (!isCredentialEndpoint) {
        callOn401();
      }

      const cleanMessage = msgFromBody
        ? String(msgFromBody)
        : isCredentialEndpoint
          ? 'Invalid email or password.'
          : 'Session expired. Please log in again.';
      return Promise.reject({ status: 401, data, message: cleanMessage });
    }

    if (__DEV__ && (status === 400 || status === 403)) {
      console.log('[API Client] Auth/validation failure', { url, status, body: data });
    }

    const cleanMessage = msgFromBody
      ? String(msgFromBody)
      : err?.message || (status ? `Request failed with status ${status}` : 'Request failed');

    return Promise.reject({
      status: status || undefined,
      data: data || undefined,
      message: cleanMessage,
    });
  }
);

export default client;
