import axios, { type AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import { normalizeError } from './errors';
import { refreshAccessToken } from './refresh';
import Logger from '../../utils/logger';

const api = axios.create({
  baseURL: '/api',
  // 30s：后端同步 key 连通性检查上限为 8s（_FETCH_TIMEOUT），
  // 因此慢供应商绝不应触发客户端超时。
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
  withCredentials: true,
});

const REFRESH_KEY = 'agentstudio_refresh_token';

/** 仅存储或清除 refresh_token——access_token 是由服务端设置的 httpOnly cookie。 */
export function setTokens(_access: string | null, refresh: string | null) {
  if (refresh) {
    localStorage.setItem(REFRESH_KEY, refresh);
  } else {
    localStorage.removeItem(REFRESH_KEY);
  }
}

/** access token 现为 httpOnly cookie——JS 无法读取。返回 null。 */
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
    // access token 在 httpOnly cookie 中（经 withCredentials 自动发送），无需 Authorization 头
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

      // 刷新端点的失败是终态——绝不再递归进入此拦截器，
      // 也不排队在本身已失败的刷新之后。
      if (retryConfig.url === '/auth/refresh') {
        return Promise.reject(normalizeError(error));
      }

      // 单飞刷新：refreshAccessToken 把并发的 401 折叠成一次后端调用
      // （服务端会轮换 refresh token），从而绝不错配消费、
      // 也绝不因竞态而误登出。
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
