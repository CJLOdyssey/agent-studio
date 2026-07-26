import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ConfigProvider, theme } from 'antd';
import { ToastProvider } from './utils/useToast';
import { AuthProvider, useAuth, LoginModal } from './components/auth';
import AgentStudioWorkstation from './components/AgentStudio/AgentStudioWorkstation';
import { prefetchAgents } from './api/hooks';
import Logger from './utils/logger';
import { useSettings } from './contexts/SettingsContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

function Fallback({ error, resetErrorBoundary }: FallbackProps) {
  const message = (error as Error)?.message || '未知错误';
  Logger.error('React render error caught by ErrorBoundary', { error: error as Error });

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 p-8 text-center text-[var(--color-text-muted)]" role="alert">
      <h2>应用出错了</h2>
      <p>{message}</p>
      <button className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium cursor-pointer border-none transition-colors duration-150 bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-elevated)] disabled:bg-[var(--color-surface-hover)] disabled:text-[var(--color-text-muted)] disabled:cursor-not-allowed" onClick={resetErrorBoundary}>
        重试
      </button>
    </div>
  );
}

function logError(error: unknown) {
  Logger.error('App Error Boundary triggered', { error: error as Error });
}

const loadingScreenStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100dvh',
  background: 'var(--color-surface, #0f1117)',
  color: 'var(--color-text-secondary, #888)',
  fontSize: 14,
};

function AppInit() {
  const queryClient = useQueryClient();

  useEffect(() => {
    prefetchAgents(queryClient);
  }, [queryClient]);
  return null;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, loginModalOpen, closeLoginModal } = useAuth();

  if (loading) {
    return <div style={loadingScreenStyle}>✦ AgentStudio</div>;
  }

  return (
    <>
      {children}
      {loginModalOpen && <LoginModal onClose={closeLoginModal} />}
    </>
  );
}

function getCssVar(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '';
}

function ThemedApp() {
  const { settings } = useSettings();
  const isDark = settings.theme === 'dark';
  const bgColor = getCssVar('--color-surface') || (isDark ? '#0f1117' : '#ffffff');
  const bgElevated = getCssVar('--color-surface-overlay') || (isDark ? '#24252d' : '#ffffff');

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#6366f1',
          colorBgContainer: bgColor,
          colorBgElevated: bgElevated,
          borderRadius: 6,
          fontSize: 14,
        },
      }}
    >
      <a className="skip-link" href="#main-content" style={{
        position: 'absolute', top: '-100%', left: 8, zIndex: 9999,
        padding: '8px 16px', background: '#6366f1', color: '#fff',
        borderRadius: '0 0 6px 6px', fontSize: 14, textDecoration: 'none',
      }} onFocus={(e) => { (e.target as HTMLElement).style.top = '0'; }}
       onBlur={(e) => { (e.target as HTMLElement).style.top = '-100%'; }}>
        跳转到主内容
      </a>
      <AuthProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ToastProvider>
            <AuthGate>
              <AppInit />
              <Routes>
                <Route
                  path="*"
                  element={
                    <ErrorBoundary FallbackComponent={Fallback} onError={logError}>
                      <AgentStudioWorkstation />
                    </ErrorBoundary>
                  }
                />
              </Routes>
            </AuthGate>
          </ToastProvider>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemedApp />
    </QueryClientProvider>
  );
}
