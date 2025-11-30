// src/api/aiClient.ts
import axios from 'axios';
import { AI_BASE_URL } from '../config';

const aiClient = axios.create({
  baseURL: AI_BASE_URL,
  timeout: 10000,
});

aiClient.interceptors.request.use((config) => {
  console.log('[AI Client] Request:', {
    url: `${config.baseURL}${config.url}`,
    method: config.method,
    data: config.data,
  });
  return config;
});

aiClient.interceptors.response.use(
  (response) => {
    console.log('[AI Client] Response:', {
      status: response.status,
      data: response.data,
    });
    return response;
  },
  (error) => {
    console.error('[AI Client] Error:', {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    });
    return Promise.reject(error);
  }
);

export default aiClient;

