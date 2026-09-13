import { refreshTokens } from './auth';

/**
 * 单飞刷新协调器。
 *
 * axios 401 拦截器和 AuthContext 都会触发 token 刷新。
 * 后端会轮换（消费）refresh token，因此两个并发刷新会竞态：
 * 一个成功，另一个 401 被误判为「会话过期」（登出 + 清空模型选择）。
 * 本模块把并发刷新折叠成一次请求，使刷新绝不被二次消费。
 * refresh_token 在 httpOnly cookie 中 —— 由 withCredentials 自动携带。
 */
let refreshPromise: Promise<void> | null = null;

export function refreshAccessToken(): Promise<void> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = refreshTokens().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}
