import * as logger from './logger';

export function installGlobalErrorHandlers() {
  if (typeof window === 'undefined') return;

  window.onerror = (message, source, lineno, colno, error) => {
    logger.error('Uncaught error', { message, source, lineno, colno, error });
    return false;
  };

  window.onunhandledrejection = (event) => {
    logger.error('Unhandled promise rejection', { reason: event.reason });
  };
}
