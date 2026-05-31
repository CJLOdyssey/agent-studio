import '@testing-library/jest-dom';
import { vi } from 'vitest';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../contexts/SettingsContext';
import { ToastProvider } from '../utils/useToast';
import '../i18n/index';

Element.prototype.scrollIntoView = vi.fn();

export function TestProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </SettingsProvider>
  );
}
