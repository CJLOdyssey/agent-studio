import axios, { type AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import { normalizeError } from './errors';
import { refreshAccessToken } from './refresh';
import Logger from '../../utils/logger';

const api = axios.create({
  baseURL: '/api',
  // 30s: backend sync key connectivity checks are capped at 8s (_FETCH_TIMEOUT),
  // so slow providers must never surface a client-side timeout.
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
  withCredentials: true,
});

const REFRESH_KEY = 'agentstudio_refresh_token';

/** Store or clear the refresh_token only — access_token is an httpOnly cookie set by the server. */
export function setTokens(_access: string | null, refresh: string | null) {
  if (refresh) {
    localStorage.setItem(REFRESH_KEY, refresh);
  } else {
    localStorage.removeItem(REFRESH_KEY);
  }
}

/** Access token is now an httpOnly cookie — not readable from JS. Returns null. */
export function getAccessToken(): string | null {
  return null;
}

export function clearTokens() {
  setTokens(null, null);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === REFRESH_KEY && !e.newValue) {
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

if (api.interceptors?.request) {
  api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    // Access token is in httpOnly cookie (auto-sent via withCredentials), no Authorization header needed
    let uid = localStorage.getItem('agentstudio_user_id');
    if (!uid) {
      uid = 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('agentstudio_user_id', uid);
    }
    config.headers['X-User-ID'] = uid;
    Logger.debug('[API] %s %s', config.method?.toUpperCase(), config.url);
    return config;
  });
}

if (api.interceptors?.response) {
  api.interceptors.response.use(
    (response: AxiosResponse) => {
      Logger.debug('[API] %s %s -> %s', response.config.method?.toUpperCase(), response.config.url, response.status);
      return response;
    },
    async (error: unknown) => {
      const axiosError = error as AxiosError;
      const retryConfig = axiosError.config as RetryConfig | undefined;
      const status = axiosError.response?.status ?? 0;
      const method = retryConfig?.method?.toUpperCase() ?? '?';
      const url = retryConfig?.url ?? '?';
      if (status !== 401) {
        Logger.error('[API] %s %s -> %s %s', method, url, status, axiosError.message);
      }
      if (!retryConfig || retryConfig._retry || status !== 401) {
        return Promise.reject(normalizeError(error));
      }

      // Refresh endpoint failures are terminal — never recurse into this
      // interceptor or queue behind a refresh that is itself failing.
      if (retryConfig.url === '/auth/refresh') {
        return Promise.reject(normalizeError(error));
      }

      // Single-flight refresh: refreshAccessToken collapses concurrent 401s
      // into one backend call (the server rotates refresh tokens), so we never
      // double-consume and never spuriously log out on a race.
      retryConfig._retry = true;
      try {
        await refreshAccessToken();
        return api(retryConfig);
      } catch (refreshErr) {
        const rs = (refreshErr as { response?: { status?: number } })?.response?.status;
        if (rs === 401 || rs === 403) {
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
        return Promise.reject(normalizeError(error));
      }
    },
  );
}

export default api;
