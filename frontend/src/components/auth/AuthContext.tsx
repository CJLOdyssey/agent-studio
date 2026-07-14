import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import {
  getAuthConfig,
  getMe,
  mergeGuestData as apiMergeGuestData,
  refreshTokens,
  login as apiLogin,
  register as apiRegister,
  verify as apiVerify,
  forgotPassword as apiForgotPassword,
  resetPassword as apiResetPassword,
  resendVerification as apiResendVerification,
  sendRegisterCode as apiSendRegisterCode,
} from '../../api/client/auth';
import { clearTokens, setTokens } from '../../api/client/instance';
import { useChatStore } from '../../stores/chatStore';

function clearLocalConversations() {
  try {
    localStorage.removeItem('agentstudio-conversations');
    window.dispatchEvent(new Event('agentstudio-conversations-updated'));
  } catch {}
}

export type AuthModalView = 'login' | 'register' | 'verify' | 'forgot' | 'reset';

export interface AuthUser {
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

  useEffect(() => {
    let cancelled = false;
    let authenticated = false;

    async function init() {
      try {
        const config = await getAuthConfig();
        if (cancelled) return;
        const isLegacy = !config.enabled || config.mode === 'legacy';
        setLegacyMode(isLegacy);

        if (isLegacy) {
          setLoading(false);
          return;
        }

        // Skip /me call if no tokens exist — avoids 401 console noise for guests
        const at = localStorage.getItem('agentstudio_access_token');
        const rt = localStorage.getItem('agentstudio_refresh_token');
        if (!at && !rt) {
          setLoading(false);
          return;
        }

        try {
          const me = await getMe();
          if (!cancelled && me) {
            authenticated = true;
            setUser({ userId: me.id, email: me.email, username: me.username, roles: me.roles });
            window.dispatchEvent(new CustomEvent('auth:login'));
            await _mergeGuest();
          }
        } catch {
          // Token may be expired — try refreshing before giving up
          const rt = localStorage.getItem('agentstudio_refresh_token');
          let refreshed = false;
          if (rt) {
            try {
              const res = await refreshTokens(rt);
              setTokens(res.access_token, res.refresh_token);
              refreshed = true;
            } catch {
              clearTokens();
            }
          }
          if (!cancelled && refreshed) {
            try {
              const me = await getMe();
              if (me) {
                authenticated = true;
                setUser({ userId: me.id, email: me.email, username: me.username, roles: me.roles });
                window.dispatchEvent(new CustomEvent('auth:login'));
                await _mergeGuest();
              }
            } catch {
              // Refresh succeeded but /me still failed — token invalid
            }
          }
        }
      } catch {
        // Auth config unavailable
      } finally {
        if (!cancelled) {
          setLoading(false);
          if (!authenticated) {
            clearLocalConversations();
          }
        }
      }
    }
    init();

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'agentstudio_refresh_token' && !e.newValue) {
        setUser(null);
        clearTokens();
        clearLocalConversations();
        setLoginModalOpen(true);
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const isAuthenticated = !legacyMode && user !== null;

  const _mergeGuest = useCallback(async () => {
    try {
      const guestId = localStorage.getItem('agentstudio_user_id');
      if (guestId) await apiMergeGuestData(guestId);
    } catch { /* merge is best-effort */ }
  }, []);

  const login = useCallback(async (email: string, password: string, rememberMe?: boolean) => {
    const res = await apiLogin(email, password, rememberMe);
    setTokens(res.access_token, res.refresh_token);
    setUser({ userId: res.user.id, email: res.user.email, username: res.user.username, roles: res.user.roles });
    window.dispatchEvent(new CustomEvent('auth:login'));
    void _mergeGuest();
  }, [_mergeGuest]);

  const register = useCallback(async (email: string, code: string, password: string) => {
    const res = await apiRegister(email, code, password);
    setTokens(res.access_token, res.refresh_token);
    setUser({ userId: res.user.id, email: res.user.email, username: res.user.username, roles: res.user.roles });
    window.dispatchEvent(new CustomEvent('auth:login'));
    void _mergeGuest();
  }, [_mergeGuest]);

  const verify = useCallback(async (email: string, code: string) => {
    const res = await apiVerify(email, code);
    setTokens(res.access_token, res.refresh_token);
    setUser({ userId: res.user.id, email: res.user.email, username: res.user.username, roles: res.user.roles });
    window.dispatchEvent(new CustomEvent('auth:login'));
    void _mergeGuest();
  }, [_mergeGuest]);

  const forgotPassword = useCallback(async (email: string) => {
    await apiForgotPassword(email);
  }, []);

  const resetPassword = useCallback(async (email: string, code: string, newPassword: string) => {
    await apiResetPassword(email, code, newPassword);
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    clearTokens();
    clearLocalConversations();
    useChatStore.getState().reset();
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
