import axios, { AxiosError } from 'axios';
import { AI_BASE_URL } from '../config';

// AI client for Python FastAPI backend
// This client is separate from the main Node.js API client
const aiClient = axios.create({
  baseURL: AI_BASE_URL,
  timeout: 15000,
});

// Request interceptor for debug logging
aiClient.interceptors.request.use(
  (config) => {
    // Debug logging (development only)
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      const fullUrl = `${config.baseURL}${config.url}`;
      console.log(`[AI Client] ${config.method?.toUpperCase()} ${fullUrl}`);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
aiClient.interceptors.response.use(
  (res) => {
    // Debug logging (development only)
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      const fullUrl = `${res.config.baseURL}${res.config.url}`;
      console.log(`[AI Client] ${res.config.method?.toUpperCase()} ${fullUrl} - Success (${res.status})`);
    }
    return res;
  },
  async (err: AxiosError) => {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const fullUrl = err?.config ? `${err.config.baseURL}${err.config.url}` : 'unknown';
    
    // Debug logging (development only)
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.error(`[AI Client] Request failed: ${err.config?.method?.toUpperCase()} ${fullUrl}`);
      console.error(`[AI Client] Error status: ${status || 'N/A'}, message: ${err?.message || 'N/A'}`);
      if (data) {
        console.error(`[AI Client] Error data:`, data);
      }
    }
    
    // Return clean error message
    const cleanMessage = (data && typeof data === 'object' && 'detail' in data ? (data as any).detail : null) ||
                        (data && typeof data === 'object' && 'message' in data ? (data as any).message : null) ||
                        err?.message ||
                        (status ? `Request failed with status ${status}` : 'Request failed');
    
    return Promise.reject({
      status: status || undefined,
      data: data || undefined,
      message: cleanMessage,
    });
  }
);

console.log('[AI Client] Using baseURL =', AI_BASE_URL);

export default aiClient;

