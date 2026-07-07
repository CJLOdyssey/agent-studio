import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import { SettingsProvider } from './contexts/SettingsContext';
import { installGlobalErrorHandlers } from './utils/errorHandler';
import './i18n/index';
import './styles/tokens.css';
import './styles/tailwind-entry.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/workstation.css';
import './styles/sidebar/index.css';
import './styles/chat/index.css';
import './styles/components/index.css';
import './styles/modals/index.css';
import './styles/workstation-layout.css';
import './styles/workstation-table.css';
import './styles/workstation-toolbar.css';
import './styles/workstation-modal.css';
import './styles/workstation-dropdown.css';
import './styles/workstation-responsive.css';
import './styles/workstation-monitor.css';
import './styles/workstation-settings.css';

installGlobalErrorHandlers();

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    environment: (import.meta.env.VITE_APP_ENV as string) || 'development',
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.25,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </React.StrictMode>,
);
