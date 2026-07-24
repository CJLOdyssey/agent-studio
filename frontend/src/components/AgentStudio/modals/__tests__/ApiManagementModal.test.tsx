import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ApiManagementModal from '../ApiManagementModal';
import { TestProviders } from '../../../../test/setup';

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const map: Record<string, string> = {
          'api.tab_provider': 'API 提供商',
          'api.tab_model': '模型选择',
          'api.tab_usage': '使用量',
        };
        return map[key] || key;
      },
    }),
  };
});

vi.mock('lucide-react', () => ({
  Key: () => <span data-testid="icon-key" />,
  Server: () => <span data-testid="icon-server" />,
  Globe: () => <span data-testid="icon-globe" />,
  X: () => <span data-testid="icon-x" />,
}));

vi.mock('../ApiProviderTab', () => ({
  default: () => <div data-testid="api-provider-tab">Provider Tab</div>,
}));

vi.mock('../ApiUsageTab', () => ({
  default: () => <div data-testid="api-usage-tab">Usage Tab</div>,
}));

vi.mock('../ModelSelector', () => ({
  default: () => <div data-testid="model-selector">Model Selector</div>,
}));

vi.mock('../ProviderEditModal', () => ({
  default: () => <div data-testid="provider-edit-modal">Edit Modal</div>,
}));

vi.mock('../../../../api/client', () => ({
  listKeys: vi.fn(() => Promise.resolve([
    { id: 'k1', provider: 'openai', usage_type: 'llm', label: 'My Key', key_masked: 'sk-...', base_url: '', models: ['gpt-4'], is_active: true, is_default: true, last_used_at: null, created_at: null },
  ])),
  getKeyUsage: vi.fn(() => Promise.resolve({ today_requests: 10, today_tokens: 500, month_requests: 100, month_tokens: 5000 })),
}));

describe('ApiManagementModal', { tags: ['integration'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should render title and all tabs', async () => {
    render(
      <TestProviders>
        <ApiManagementModal onClose={vi.fn()} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText('API 管理')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText('API 提供商')).toBeInTheDocument();
    });
    expect(screen.getByText('模型选择')).toBeInTheDocument();
    expect(screen.getByText('使用量')).toBeInTheDocument();
    expect(screen.getByTestId('api-provider-tab')).toBeInTheDocument();
  });

  it('should switch between tabs when clicking tab buttons', async () => {
    render(
      <TestProviders>
        <ApiManagementModal onClose={vi.fn()} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText('API 提供商')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('模型选择'));
    expect(screen.getByTestId('model-selector')).toBeInTheDocument();

    fireEvent.click(screen.getByText('使用量'));
    expect(screen.getByTestId('api-usage-tab')).toBeInTheDocument();

    fireEvent.click(screen.getByText('API 提供商'));
    expect(screen.getByTestId('api-provider-tab')).toBeInTheDocument();
  });

  it('should close modal when close button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <TestProviders>
        <ApiManagementModal onClose={onClose} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText('API 管理')).toBeInTheDocument();
    });

    const closeBtn = document.querySelector('.modal-close');
    expect(closeBtn).not.toBeNull();
    fireEvent.click(closeBtn!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should close modal on overlay click', async () => {
    const onClose = vi.fn();
    render(
      <TestProviders>
        <ApiManagementModal onClose={onClose} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText('API 管理')).toBeInTheDocument();
    });

    const overlay = document.querySelector('.modal-overlay');
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should load keys on mount', async () => {
    const { listKeys } = await vi.importMock<typeof import('../../../../api/client')>('../../../../api/client');

    render(
      <TestProviders>
        <ApiManagementModal onClose={vi.fn()} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText('API 提供商')).toBeInTheDocument();
    });
    expect(listKeys).toHaveBeenCalledTimes(1);
  });

  it('should load usage on mount', async () => {
    const { getKeyUsage } = await vi.importMock<typeof import('../../../../api/client')>('../../../../api/client');

    render(
      <TestProviders>
        <ApiManagementModal onClose={vi.fn()} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText('API 提供商')).toBeInTheDocument();
    });
    expect(getKeyUsage).toHaveBeenCalled();
  });
});
