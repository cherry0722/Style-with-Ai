import axios from 'axios';
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
  (err) => {
    const status = err?.response?.status;
    const data = err?.response?.data;
    return Promise.reject({ status, data, message: err?.message ?? 'Request failed' });
  }
);

export default client;

