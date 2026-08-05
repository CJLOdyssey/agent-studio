import { describe, it, expect, vi, beforeEach, type ReactNode } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import ApiManagementModal from '../ApiManagementModal';
import type { KeyItem } from '../../../../api/client';

type KeyCreateConfig = {
  provider: string;
  usage_type?: string;
  label: string;
  api_key: string;
  base_url?: string;
  models?: string[];
  is_default?: boolean;
};

vi.mock('../../../../api/client', () => {
  const keys: KeyItem[] = [];
  return {
    listKeys: vi.fn(async () => [...keys]),
    createKey: vi.fn(async (cfg: KeyCreateConfig) => {
      const item: KeyItem = {
        id: 'k-new',
        provider: cfg.provider,
        usage_type: cfg.usage_type || 'chat',
        label: cfg.label,
        key_masked: 'sk-***',
        base_url: cfg.base_url || '',
        models: cfg.models || [],
        is_active: true,
        is_default: false,
        last_used_at: null,
        created_at: null,
      };
      keys.push(item);
      return item;
    }),
    updateKey: vi.fn(async (id: string) => ({ id })),
    deleteKey: vi.fn(async () => ({ ok: true })),
    getKeyUsage: vi.fn(async () => ({ today_requests: 0, today_tokens: 0, month_requests: 0, month_tokens: 0 })),
    testKeyConnection: vi.fn(async () => ({ success: true, message: 'ok' })),
    getKeyUsageSummary: vi.fn(async () => ({})),
  };
});

vi.mock('../../../../api/client/keys', () => ({
  fetchModelsFromProvider: vi.fn(async () => ({ success: true, models: [] })),
}));

vi.mock('../../../../api/client/providers', () => ({
  listProviders: vi.fn(async () => ({
    custom: { name: '自定义', base_url: '', capabilities: ['chat'], docs_url: null },
  })),
}));

function KeysProbe() {
  const { data } = useQuery({ queryKey: ['keys'], queryFn: async () => (await import('../../../../api/client')).listKeys() });
  const count = data?.length ?? 0;
  return <span data-testid="probe-count">{count}</span>;
}

describe('ApiManagementModal invalidation', { tags: ['integration'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refetches the ["keys"] query after adding an API key (main UI updates without refresh)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    render(<KeysProbe />, { wrapper });
    await waitFor(() => expect(screen.getByTestId('probe-count')).toHaveTextContent('0'));

    render(<ApiManagementModal onClose={vi.fn()} />, { wrapper });

    await waitFor(() => expect(screen.getByText('添加 Key')).toBeInTheDocument());
    fireEvent.click(screen.getByText('添加 Key'));

    await waitFor(() => expect(screen.getByPlaceholderText('备注名')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('备注名'), { target: { value: '我的新 Key' } });
    fireEvent.change(screen.getByPlaceholderText('sk-...'), { target: { value: 'sk-new-test-key' } });

    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => expect(screen.getByTestId('probe-count')).toHaveTextContent('1'), {
      timeout: 3000,
    });
  });
});
