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
    <div className="error-boundary" role="alert">
      <h2>应用出错了</h2>
      <p>{message}</p>
      <button className="btn btn-primary" onClick={resetErrorBoundary}>
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
  height: '100vh',
  background: 'var(--da-bg-primary, #0f1117)',
  color: 'var(--da-text-secondary, #888)',
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

function ThemedApp() {
  const { settings } = useSettings();
  const isDark = settings.theme === 'dark';

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#6366f1',
          colorBgContainer: isDark ? '#1a1a1a' : '#ffffff',
          colorBgElevated: isDark ? '#242424' : '#ffffff',
          borderRadius: 6,
          fontSize: 14,
        },
      }}
    >
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
