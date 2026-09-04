import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import {
  getAuthConfig,
  getMe,
  mergeGuestData as apiMergeGuestData,
  login as apiLogin,
  register as apiRegister,
  verify as apiVerify,
  forgotPassword as apiForgotPassword,
  resetPassword as apiResetPassword,
  resendVerification as apiResendVerification,
  sendRegisterCode as apiSendRegisterCode,
  logout as apiLogout,
} from '../../api/client/auth';
import { clearTokens, setTokens } from '../../api/client/instance';
import { refreshAccessToken } from '../../api/client/refresh';
import { useChatStore } from '../../stores/chatStore';

function clearLocalConversations() {
  try {
    localStorage.removeItem('agentstudio-conversations');
    window.dispatchEvent(new Event('agentstudio-conversations-updated'));
  } catch {}
}

/** access token TTL 为 15 分钟——每 10 分钟续期一次，保证标签页打开期间永不过期。 */
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

async function mergeGuest() {
  try {
    const guestId = localStorage.getItem('agentstudio_user_id');
    if (guestId) await apiMergeGuestData(guestId);
  } catch { /* 合并尽力而为 */ }
}

export type AuthModalView = 'login' | 'register' | 'verify' | 'forgot' | 'reset';

interface AuthUser {
  userId: string;
  email: string;
  username: string | null;
  roles: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  legacyMode: boolean;
  isAuthenticated: boolean;
  loginModalOpen: boolean;
  loginModalView: AuthModalView;
  loginModalEmail: string;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (email: string, code: string, password: string) => Promise<void>;
  verify: (email: string, code: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  sendRegisterCode: (email: string) => Promise<{ emailHint: string }>;
  openLoginModal: (view?: AuthModalView) => void;
  closeLoginModal: () => void;
  setLoginModalEmail: (email: string) => void;
  setLoginModalView: (view: AuthModalView) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [legacyMode, setLegacyMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginModalView, setLoginModalView] = useState<AuthModalView>('login');
  const [loginModalEmail, setLoginModalEmail] = useState('');
  const refreshTimerRef = useRef<number | null>(null);
  const lastRefreshRef = useRef(0);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    // 单飞刷新：axios 401 拦截器与本定时器共享同一协调器，
    // 使轮换后的 refresh_token 绝不被二次消费
    // （竞态会让其中一路 401 并误登出用户）。
    try {
      await refreshAccessToken();
      lastRefreshRef.current = Date.now();
      return true;
    } catch (err) {
      // refresh_token 失效（401/403）→ 会话过期：登出，避免"幽灵登录"后
      // 业务请求以 anonymous 身份报误导性 400。网络错误不登出（由定时器重试）。
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let authenticated = false;

    async function applyMe(me: { id: string; email: string; username: string | null; roles: string[] }) {
      if (cancelled) return;
      authenticated = true;
      setUser({ userId: me.id, email: me.email, username: me.username, roles: me.roles });
      localStorage.setItem('agentstudio_user_id', me.id);
      window.dispatchEvent(new CustomEvent('auth:login'));
      void mergeGuest();
    }

    async function tryRestore(): Promise<boolean> {
      try {
        const me = await getMe();
        if (!me) return false;
        await applyMe(me);
        return true;
      } catch {
        return false;
      }
    }

    async function init() {
      try {
        // B：身份恢复与认证配置并行执行——慢速的 config 请求
        // 不应阻塞刷新时显示已登录用户。
        const [config, restored] = await Promise.all([
          getAuthConfig().catch(() => null),
          (async () => {
            try {
              return await tryRestore();
            } catch {
              return false;
            }
          })(),
        ]);
        if (cancelled) return;
        setLegacyMode(!config?.enabled || config?.mode === 'legacy');

        if (restored) return;
        // access token 可能已过期——放弃前先刷新。
        if (await refreshSession()) {
          // 刷新返回 200 但 getMe 仍失败（例如 Secure cookie
          // 被 http 客户端丢弃）——不要保留幽灵登录（UI 显示用户
          // 而每个请求都以 anonymous 身份运行）。
          if (!(await tryRestore())) {
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
          }
        }
        // else（refreshSession false）：401/403 已由 refreshSession 内部 dispatch
        // auth:unauthorized（登出并清 token）；网络错误必须保留 refresh_token 供
        // 定时器重试 —— 否则清掉 token 后永久假登录（UI 显示 admin、无法恢复）。
      } catch {
        // 认证配置不可用
      } finally {
        if (!cancelled) {
          setLoading(false);
          if (!authenticated) {
            clearLocalConversations();
          }
        }
      }
    }
    void init();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'agentstudio_refresh_token' && !e.newValue) {
        setUser(null);
        clearTokens();
        clearLocalConversations();
        setLoginModalOpen(true);
      }
    };
    const handleUnauthorized = () => {
      setUser(null);
      clearLocalConversations();
      // 模型选择是用户偏好，与认证无关 —— 不清除，否则重新登录后仍走默认
      // 模型（历史上"一直走 deepseek"的根因之一）。
      localStorage.removeItem('agentstudio-active-conv-id');
      setLoginModalOpen(true);
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [refreshSession]);

  // 在页面保持打开期间续期短生命周期的 access_token（15 分钟 TTL）：
  // cookie 过期后后端业务端点会静默回退到 guest，
  // 没有它 UI 会看似已登录而每个请求都失败。
  useEffect(() => {
    const start = () => {
      lastRefreshRef.current = Date.now();
      if (refreshTimerRef.current !== null) return;
      // 每 10 分钟续期一次；失败（后端重启/瞬时故障）时 60 秒快速重试，
      // 避免 access_token 在 15 分钟 TTL 内过期且无人续期。
      let failureBackoff = false;
      refreshTimerRef.current = window.setInterval(async () => {
        const ok = await refreshSession();
        if (!ok && !failureBackoff) {
          failureBackoff = true;
          window.setTimeout(() => {
            failureBackoff = false;
            void refreshSession();
          }, 60_000);
        }
      }, REFRESH_INTERVAL_MS);
    };
    const stop = () => {
      if (refreshTimerRef.current !== null) {
        window.clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
    const handleVisibility = () => {
      // 浏览器会节流后台标签页的定时器——返回时立即刷新
      if (
        document.visibilityState === 'visible' &&
        Date.now() - lastRefreshRef.current >= REFRESH_INTERVAL_MS
      ) {
        void refreshSession();
      }
    };
    window.addEventListener('auth:login', start);
    window.addEventListener('auth:logout', stop);
    window.addEventListener('auth:unauthorized', stop);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('auth:login', start);
      window.removeEventListener('auth:logout', stop);
      window.removeEventListener('auth:unauthorized', stop);
      document.removeEventListener('visibilitychange', handleVisibility);
      stop();
    };
  }, [refreshSession]);

  const isAuthenticated = user !== null;

  const login = useCallback(async (email: string, password: string, rememberMe?: boolean) => {
    const res = await apiLogin(email, password, rememberMe);
    setTokens(res.access_token, res.refresh_token);
    setLoading(false);
    setUser({ userId: res.user.id, email: res.user.email, username: res.user.username, roles: res.user.roles });
    localStorage.setItem('agentstudio_user_id', res.user.id);
    window.dispatchEvent(new CustomEvent('auth:login'));
    void mergeGuest();
  }, []);

  const register = useCallback(async (email: string, code: string, password: string) => {
    const res = await apiRegister(email, code, password);
    setTokens(res.access_token, res.refresh_token);
    setLoading(false);
    setUser({ userId: res.user.id, email: res.user.email, username: res.user.username, roles: res.user.roles });
    localStorage.setItem('agentstudio_user_id', res.user.id);
    window.dispatchEvent(new CustomEvent('auth:login'));
    void mergeGuest();
  }, []);

  const verify = useCallback(async (email: string, code: string) => {
    const res = await apiVerify(email, code);
    setTokens(res.access_token, res.refresh_token);
    setLoading(false);
    setUser({ userId: res.user.id, email: res.user.email, username: res.user.username, roles: res.user.roles });
    localStorage.setItem('agentstudio_user_id', res.user.id);
    window.dispatchEvent(new CustomEvent('auth:login'));
    void mergeGuest();
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    await apiForgotPassword(email);
  }, []);

  const resetPassword = useCallback(async (email: string, code: string, newPassword: string) => {
    await apiResetPassword(email, code, newPassword);
  }, []);

  const logout = useCallback(async () => {
    // 先通知后端撤销 refresh token 并清除 httpOnly access_token cookie，
    // 否则 cookie 残留会在刷新后自动恢复登录（"刷新后又登录"）。
    // token 已失效时后端调用失败，忽略并继续完成本地登出。
    try {
      const rt = localStorage.getItem('agentstudio_refresh_token');
      if (rt) await apiLogout(rt);
    } catch {
      // 后端登出失败（token 已失效 / 网络）— 仍完成本地登出
    }
    setUser(null);
    clearTokens();
    clearLocalConversations();
    localStorage.removeItem('agentstudio_user_id');
    localStorage.removeItem('agentstudio-selected-model');
    localStorage.removeItem('agentstudio-active-conv-id');
    useChatStore.getState().reset();
    setLoginModalOpen(true);
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    await apiResendVerification(email);
  }, []);

  const sendRegisterCode = useCallback(async (email: string) => {
    const res = await apiSendRegisterCode(email);
    return { emailHint: res.email_hint };
  }, []);

  const openLoginModal = useCallback((view?: AuthModalView) => {
    setLoginModalView(view || 'login');
    setLoginModalOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setLoginModalOpen(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        legacyMode,
        isAuthenticated,
        loginModalOpen,
        loginModalView,
        loginModalEmail,
        login,
        register,
        verify,
        forgotPassword,
        resetPassword,
        logout,
        resendVerification,
        sendRegisterCode,
        openLoginModal,
        closeLoginModal,
        setLoginModalEmail,
        setLoginModalView,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
