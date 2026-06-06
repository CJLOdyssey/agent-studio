import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ToastProvider } from './utils/useToast';
import { useChatStore } from './stores/chatStore';
import { prefetchAgents } from './api/hooks';
import Logger from './utils/logger';

const DevAgentsWorkstation = lazy(() => import('./components/devagents/DevAgentsWorkstation'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

function AppInit() {
  const queryClient = useQueryClient();
  const loadAgents = useChatStore((s) => s.loadAgents);
  const agentsLoaded = useChatStore((s) => s.agentsLoaded);

  useEffect(() => {
    if (!agentsLoaded) {
      loadAgents();
      // Also populate React Query cache so useAgents() returns data immediately
      prefetchAgents(queryClient);
    }
  }, [agentsLoaded, loadAgents, queryClient]);
  return null;
}

function Fallback({ error, resetErrorBoundary }: FallbackProps) {
  const message = (error as Error)?.message || '未知错误';
  // Report to Sentry automatically via logger
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppInit />
        <ToastProvider>
          <Suspense
            fallback={
              <div className="route-loading" aria-label="Loading page">
                Loading...
              </div>
            }
          >
            <Routes>
              <Route
                path="*"
                element={
                  <ErrorBoundary FallbackComponent={Fallback} onError={logError}>
                    <DevAgentsWorkstation />
                  </ErrorBoundary>
                }
              />
            </Routes>
          </Suspense>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
