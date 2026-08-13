import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsProvider } from '../contexts/SettingsContext';
import { ToastProvider } from '../utils/useToast';
import App from '../App';

vi.mock('../components/AgentStudio/AgentStudioWorkstation', () => ({
  default: () => <div data-testid="workstation">Workstation</div>,
}));

describe('App', { tags: ['unit'] }, () => {
  it('renders without crashing', async () => {
    // App 自带 BrowserRouter — 不包 TestProviders（其 MemoryRouter 会嵌套冲突）。
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <SettingsProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </SettingsProvider>
      </QueryClientProvider>,
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId('workstation')).toBeTruthy();
    }, { timeout: 5000 });
  });
});
