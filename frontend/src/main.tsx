import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || '',
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // 性能监控
  tracesSampleRate: 1.0, // 开发环境捕获 100% 事务；生产环境应降低
  // 会话回放
  replaysSessionSampleRate: 0.1, // 10% 的会话
  replaysOnErrorSampleRate: 1.0, // 100% 的错误会话
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
});

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SettingsProvider } from './contexts/SettingsContext';
import { installGlobalErrorHandlers } from './utils/errorHandler';
import './i18n/index';
import './styles/tailwind-entry.css';
import './styles/modals/index.css';
import './styles/workstation/index.css';

installGlobalErrorHandlers();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <Sentry.ErrorBoundary fallback={<p>An error has occurred</p>} showDialog>
    <React.StrictMode>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </React.StrictMode>
  </Sentry.ErrorBoundary>,
);
