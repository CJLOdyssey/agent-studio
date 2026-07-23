import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ToastProvider } from './utils/useToast';
import { AuthProvider, useAuth, LoginModal } from './components/auth';
import AgentStudioWorkstation from './components/AgentStudio/AgentStudioWorkstation';
import { prefetchAgents } from './api/hooks';
import Logger from './utils/logger';

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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}
