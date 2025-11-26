import axios, { AxiosError } from 'axios';
import { API_BASE_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

async function getToken() {
  try {
    // React Native: use AsyncStorage
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) return token;
    } catch {
      // Fallback to localStorage for web
    }
    
    // Web: use localStorage
    if (typeof localStorage !== 'undefined') {
      return localStorage?.getItem?.('token') ?? undefined;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

console.log('[API Client] Using baseURL =', API_BASE_URL);

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
  
  // Debug logging (development only)
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const fullUrl = `${config.baseURL}${config.url}`;
    console.log(`[API Client] ${config.method?.toUpperCase()} ${fullUrl}`);
  }
  
  return config;
});

client.interceptors.response.use(
  (res) => {
    // Debug logging (development only)
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      const fullUrl = `${res.config.baseURL}${res.config.url}`;
      console.log(`[API Client] ${res.config.method?.toUpperCase()} ${fullUrl} - Success (${res.status})`);
    }
    return res;
  },
  async (err: AxiosError) => {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const fullUrl = err?.config ? `${err.config.baseURL}${err.config.url}` : 'unknown';
    
    // Debug logging (development only)
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.error(`[API Client] Request failed: ${err.config?.method?.toUpperCase()} ${fullUrl}`);
      console.error(`[API Client] Error status: ${status || 'N/A'}, message: ${err?.message || 'N/A'}`);
      if (data) {
        console.error(`[API Client] Error data:`, data);
      }
    }
    
    // Return clean error message
    const cleanMessage = (data && typeof data === 'object' && 'message' in data ? (data as any).message : null) || 
                        err?.message || 
                        (status ? `Request failed with status ${status}` : 'Request failed');
    
    return Promise.reject({ 
      status: status || undefined, 
      data: data || undefined, 
      message: cleanMessage 
    });
  }
);

export default client;

