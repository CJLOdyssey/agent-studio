import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { normalizeError } from './errors';
import { refreshTokens } from './auth';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
  withCredentials: true,
});

const ACCESS_KEY = 'agentstudio_access_token';
const REFRESH_KEY = 'agentstudio_refresh_token';

let accessToken: string | null = localStorage.getItem(ACCESS_KEY);
let refreshToken: string | null = localStorage.getItem(REFRESH_KEY);

export function setTokens(access: string | null, refresh: string | null) {
  accessToken = access;
  refreshToken = refresh;
  if (access) {
    localStorage.setItem(ACCESS_KEY, access);
  } else {
    localStorage.removeItem(ACCESS_KEY);
  }
  if (refresh) {
    localStorage.setItem(REFRESH_KEY, refresh);
  } else {
    localStorage.removeItem(REFRESH_KEY);
  }
}

export function getAccessToken() {
  return accessToken;
}

export function clearTokens() {
  setTokens(null, null);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === REFRESH_KEY && !e.newValue) {
      accessToken = null;
      refreshToken = null;
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
  });
  window.addEventListener('auth:unauthorized', () => {
    clearTokens();
  });
}

interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let isRefreshing = false;
let pendingQueue: Array<(token: string) => void> = [];

if (api.interceptors?.request) {
  api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    let uid = localStorage.getItem('agentstudio_user_id');
    if (!uid) {
      uid = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('agentstudio_user_id', uid);
    }
    config.headers['X-User-ID'] = uid;
    return config;
  });
}

if (api.interceptors?.response) {
  api.interceptors.response.use(
    (response) => response,
    async (error: unknown) => {
      const axiosError = error as AxiosError;
      const retryConfig = axiosError.config as RetryConfig | undefined;
      if (!retryConfig || retryConfig._retry || axiosError.response?.status !== 401) {
        return Promise.reject(normalizeError(error));
      }

      if (!refreshToken) {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        return Promise.reject(normalizeError(error));
      }

      if (isRefreshing) {
        return new Promise((resolve) => {
          pendingQueue.push((token: string) => {
            retryConfig.headers.Authorization = `Bearer ${token}`;
            resolve(api(retryConfig));
          });
        });
      }

      retryConfig._retry = true;
      isRefreshing = true;

      try {
        const res = await refreshTokens(refreshToken);
        setTokens(res.access_token, res.refresh_token);
        pendingQueue.forEach((cb) => cb(res.access_token));
        pendingQueue = [];
        retryConfig.headers.Authorization = `Bearer ${res.access_token}`;
        return api(retryConfig);
      } catch {
        clearTokens();
        pendingQueue = [];
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        return Promise.reject(normalizeError(error));
      } finally {
        isRefreshing = false;
      }
    },
  );
}

export default api;
