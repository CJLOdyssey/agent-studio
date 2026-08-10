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
          'api.tab_api': 'API',
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

const modelSelectorProps = vi.hoisted(() => ({
  current: null as {
    models: Array<{ model: string; keyId: string; type?: string }>;
  } | null,
}));

vi.mock('../ModelSelector', () => ({
  default: (props: { models: Array<{ model: string; keyId: string; type?: string }> }) => {
    modelSelectorProps.current = props;
    return <div data-testid="model-selector">Model Selector</div>;
  },
}));

vi.mock('../ProviderEditModal', () => ({
  default: () => <div data-testid="provider-edit-modal">Edit Modal</div>,
}));

vi.mock('../../../../api/client', () => ({
  listKeys: vi.fn(() => Promise.resolve([
    { id: 'k1', provider: 'openai', usage_type: 'llm', label: 'My Key', key_masked: 'sk-...', base_url: '', models: ['gpt-4'], is_active: true, is_default: true, last_used_at: null, created_at: null },
  ])),
  getKeyUsage: vi.fn(() => Promise.resolve({ today_requests: 10, today_tokens: 500, month_requests: 100, month_tokens: 5000 })),
  listModels: vi.fn(() => Promise.resolve([
    { id: 'gpt-4', label: 'GPT-4', provider: 'openai', type: 'llm' },
    { id: 'text-embedding-3-small', label: 'Embedding', provider: 'openai', type: 'embedding' },
  ])),
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
      expect(screen.getByText('API')).toBeInTheDocument();
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
      expect(screen.getByText('API')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('模型选择'));
    expect(screen.getByTestId('model-selector')).toBeInTheDocument();

    fireEvent.click(screen.getByText('使用量'));
    expect(screen.getByTestId('api-usage-tab')).toBeInTheDocument();

    fireEvent.click(screen.getByText('API'));
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

    const closeBtn = screen.getByRole('dialog').querySelector('button[aria-label]');
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

    const overlay = screen.getByRole('dialog').parentElement;
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
      expect(screen.getByText('API')).toBeInTheDocument();
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
      expect(screen.getByText('API')).toBeInTheDocument();
    });
    expect(getKeyUsage).toHaveBeenCalled();
  });

  it('should load model types on mount and enrich model tab entries', async () => {
    const { listKeys, listModels } = await vi.importMock<typeof import('../../../../api/client')>('../../../../api/client');
    listKeys.mockResolvedValue([
      { id: 'k1', provider: 'openai', usage_type: 'llm', label: 'My Key', key_masked: 'sk-...', base_url: '', models: ['gpt-4', 'text-embedding-3-small'], is_active: true, is_default: true, last_used_at: null, created_at: null },
      { id: 'k2', provider: 'custom', usage_type: 'llm', label: 'Custom Key', key_masked: 'ck-...', base_url: '', models: ['my-model'], is_active: true, is_default: false, last_used_at: null, created_at: null },
    ]);

    render(
      <TestProviders>
        <ApiManagementModal onClose={vi.fn()} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(listModels).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText('API')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('模型选择'));
    await waitFor(() => {
      expect(modelSelectorProps.current).not.toBeNull();
    });
    expect(modelSelectorProps.current?.models).toEqual([
      { model: 'gpt-4', keyId: 'k1', type: 'llm' },
      { model: 'text-embedding-3-small', keyId: 'k1', type: 'embedding' },
      { model: 'my-model', keyId: 'k2', type: 'llm' },
    ]);
  });
});
