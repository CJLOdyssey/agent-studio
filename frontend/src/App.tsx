import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './utils/useToast';
import { useChatStore } from './stores/chatStore';

const HomePage = lazy(() => import('./pages/HomePage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const HistoryDetailPage = lazy(() => import('./pages/HistoryDetailPage'));
const DevAgentsWorkstation = lazy(() => import('./components/devagents/DevAgentsWorkstation'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});

function HistoryDetailWrapper() {
  const { id } = useParams<{ id: string }>();
  return <HistoryDetailPage id={id} />;
}

function AppInit() {
  const loadAgents = useChatStore((s) => s.loadAgents);
  const agentsLoaded = useChatStore((s) => s.agentsLoaded);
  useEffect(() => { if (!agentsLoaded) loadAgents(); }, [agentsLoaded, loadAgents]);
  return null;
}

function Fallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="error-boundary" role="alert">
      <h2>应用出错了</h2>
      <p>{(error as Error)?.message || '未知错误'}</p>
      <button className="btn btn-primary" onClick={resetErrorBoundary}>重试</button>
    </div>
  );
}

function logError(error: unknown) {
  try { console.warn('App Error:', (error as Error)?.message); } catch {}
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInit />
        <ToastProvider>
          <Suspense fallback={<div className="route-loading" aria-label="Loading page">Loading...</div>}>
            <Routes>
              <Route path="/" element={<ErrorBoundary FallbackComponent={Fallback} onError={logError}><DevAgentsWorkstation /></ErrorBoundary>} />
              <Route path="/legacy" element={<ErrorBoundary FallbackComponent={Fallback} onError={logError}><HomePage /></ErrorBoundary>} />
              <Route path="/history" element={<ErrorBoundary FallbackComponent={Fallback} onError={logError}><HistoryPage /></ErrorBoundary>} />
              <Route path="/history/:id" element={<ErrorBoundary FallbackComponent={Fallback} onError={logError}><HistoryDetailWrapper /></ErrorBoundary>} />
            </Routes>
          </Suspense>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
