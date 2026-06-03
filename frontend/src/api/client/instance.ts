import axios from 'axios';
import { normalizeError } from './errors';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
  withCredentials: true,
});

// Interceptors — guarded for environments where axios may be mocked
if (api.interceptors?.request) {
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}

if (api.interceptors?.response) {
  api.interceptors.response.use(
    (response) => response,
    (error: unknown) => normalizeError(error),
  );
}

export default api;
