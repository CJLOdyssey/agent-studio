import { refreshTokens } from './auth';

/**
 * 单飞刷新协调器。
 *
 * axios 401 拦截器和 AuthContext 都会触发 token 刷新。
 * 后端会轮换（消费）refresh token，因此两个携带同一 token 的并发刷新
 * 会竞态：一个成功，另一个 401 被误判为「会话过期」（登出 + 清空模型选择）。
 * 本模块把并发刷新折叠成一次请求并存储轮换后的 refresh_token，
 * 使刷新绝不被二次消费。
 */
let refreshPromise: Promise<void> | null = null;

export function refreshAccessToken(): Promise<void> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const rt = localStorage.getItem('agentstudio_refresh_token');
    if (!rt) throw new Error('no refresh token');
    const res = await refreshTokens(rt);
    // access token 存于 httpOnly cookie（服务端设置）；持久化轮换后的
    // refresh_token，使下一次刷新/初始化使用当前值。
    localStorage.setItem('agentstudio_refresh_token', res.refresh_token);
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}
