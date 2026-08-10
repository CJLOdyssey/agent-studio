import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestProviders } from '../../../../test/setup';

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const map: Record<string, string> = {
          'providerEdit.edit': 'Edit Provider',
          'providerEdit.add': 'Add Provider',
          'providerEdit.provider': '供应商',
          'providerEdit.name': '备注名',
          'providerEdit.nameOptional': 'optional',
          'providerEdit.baseUrl': 'Base URL',
          'providerEdit.apiKey': 'API Key',
          'providerEdit.supportedModels': '模型列表',
          'providerEdit.save': 'Save',
          'workstation.capabilities': '支持能力',
          'workstation.purpose': '用途',
          'workstation.bothSupported': '两者都支持',
          'workstation.fetchingModels': 'Fetching...',
          'workstation.enterApiKeyToFetch': '填写 API Key 后点击刷新获取模型',
          'workstation.fetchFromApi': 'Fetch',
          'confirm.cancel': 'Cancel',
          'common.close': 'Close',
        };
        return map[key] || key;
      },
    }),
  };
});

const mockFetchModels = vi.fn();
vi.mock('../../../../api/client/keys', () => ({
  fetchModelsFromProvider: (...args: unknown[]) => mockFetchModels(...args),
}));

vi.mock('../../../../api/client/providers', () => ({
  listProviders: vi.fn().mockResolvedValue({
    openai: { name: 'OpenAI', base_url: 'https://api.openai.com/v1', capabilities: ['chat', 'vector'], docs_url: null },
    custom: { name: 'Custom', base_url: '', capabilities: ['chat', 'vector'], docs_url: null },
  }),
}));

import ProviderEditModal, { type ApiProviderForm } from '../ProviderEditModal';

const baseProvider: ApiProviderForm = {
  id: '', provider: 'openai', capabilities: ['llm'],
  name: '', baseUrl: 'https://api.openai.com/v1',
  apiKey: '', models: [], isActive: true, isDefault: false,
};

function renderModal(overrides: {
  provider?: ApiProviderForm; saving?: boolean;
  onSave?: ReturnType<typeof vi.fn>; onClose?: ReturnType<typeof vi.fn>;
} = {}) {
  return render(
    <TestProviders>
      <ProviderEditModal
        provider={overrides.provider || baseProvider}
        onSave={overrides.onSave || vi.fn()}
        onClose={overrides.onClose || vi.fn()}
        saving={overrides.saving}
      />
    </TestProviders>,
  );
}

describe('ProviderEditModal', { tags: ['integration'] }, () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders add title', async () => {
    renderModal();
    expect(await screen.findByText('Add Provider')).toBeInTheDocument();
  });

  it('renders edit title when provider has id', async () => {
    renderModal({ provider: { ...baseProvider, id: 'pk_1' } });
    expect(await screen.findByText('Edit Provider')).toBeInTheDocument();
  });

  it('calls onClose when cancel clicked', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(await screen.findByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onSave with form data', async () => {
    const onSave = vi.fn();
    renderModal({ provider: { ...baseProvider, name: 'My Key', apiKey: 'sk-test123' }, onSave });
    fireEvent.click(await screen.findByText('Save'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My Key',
        apiKey: 'sk-test123',
        capabilities: ['llm', 'embedding'],
      }),
    );
  });

  it('preserves stored capabilities on same-provider edit', async () => {
    const onSave = vi.fn();
    renderModal({
      provider: { ...baseProvider, id: 'pk_1', name: 'My Key', apiKey: 'sk-test123', capabilities: ['llm'] },
      onSave,
    });
    fireEvent.click(await screen.findByText('Save'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'openai',
        capabilities: ['llm'],
      }),
    );
  });

  it('derives capabilities from catalog when provider type changes', async () => {
    const onSave = vi.fn();
    renderModal({
      provider: { ...baseProvider, id: 'pk_1', name: 'My Key', apiKey: 'sk-test123', capabilities: ['llm'] },
      onSave,
    });
    fireEvent.change(await screen.findByRole('combobox'), {
      target: { value: 'custom' },
    });
    fireEvent.click(await screen.findByText('Save'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'custom',
        capabilities: ['llm', 'embedding'],
      }),
    );
  });

  it('save button is disabled when apiKey empty', async () => {
    renderModal();
    const saveBtn = await screen.findByText('Save');
    expect(saveBtn.closest('button')).toBeDisabled();
  });

  it('fetches models when fetch button clicked', async () => {
    mockFetchModels.mockResolvedValue({ success: true, models: ['gpt-4', 'gpt-3.5-turbo'], message: '' });
    renderModal({ provider: { ...baseProvider, apiKey: 'sk-test' } });
    const fetchBtn = await screen.findByTitle('Fetch');
    fireEvent.click(fetchBtn);
    expect(mockFetchModels).toHaveBeenCalled();
  });

  it('shows loading when saving', async () => {
    renderModal({ saving: true });
    expect(await screen.findByText('...')).toBeInTheDocument();
  });

  it('stops propagation on modal content click', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    const content = document.querySelector('[role="dialog"]')!;
    fireEvent.click(content);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when overlay is clicked', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    const dialog = screen.getByRole('dialog');
    const overlay = dialog.parentElement!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('save button is disabled when only name is filled but apiKey is empty', async () => {
    renderModal({ provider: { ...baseProvider, name: 'My Key', apiKey: '' } });
    const saveBtn = await screen.findByText('Save');
    expect(saveBtn.closest('button')).toBeDisabled();
  });

  it('save button is disabled when only apiKey is filled but name is empty', async () => {
    renderModal({ provider: { ...baseProvider, name: '', apiKey: 'sk-test' } });
    const saveBtn = await screen.findByText('Save');
    expect(saveBtn.closest('button')).toBeDisabled();
  });

  it('fetch 成功后每行渲染类型下拉，改类型后保存载荷含 model_types', async () => {
    mockFetchModels.mockResolvedValue({
      success: true,
      models: ['gpt-4', 'text-embedding-3'],
      types: { 'gpt-4': 'llm', 'text-embedding-3': 'embedding' },
    });
    const onSave = vi.fn();
    renderModal({
      provider: { ...baseProvider, name: 'My Key', apiKey: 'sk-test' },
      onSave,
    });

    fireEvent.click(await screen.findByTitle('Fetch'));

    await waitFor(() =>
      expect(screen.getByText('text-embedding-3')).toBeInTheDocument(),
    );

    const gptType = screen.getByRole('combobox', {
      name: 'gpt-4 类型',
    }) as HTMLSelectElement;
    expect(gptType.value).toBe('llm');
    expect(screen.getAllByRole('combobox').length).toBeGreaterThan(1);

    fireEvent.change(gptType, { target: { value: 'embedding' } });
    fireEvent.click(screen.getByText('Save'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        model_types: { 'gpt-4': 'embedding', 'text-embedding-3': 'embedding' },
      }),
    );
  });

  it('fetch 失败时类型 map 保持为空，保存载荷传空 model_types', async () => {
    mockFetchModels.mockResolvedValue({
      success: false,
      models: [],
      message: 'Connection refused',
    });
    const onSave = vi.fn();
    renderModal({
      provider: { ...baseProvider, name: 'My Key', apiKey: 'sk-test' },
      onSave,
    });

    fireEvent.click(await screen.findByTitle('Fetch'));
    await waitFor(() =>
      expect(screen.getByText('Connection refused')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText('Save'));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ model_types: {} }),
    );
  });

  it('编辑已有 key 时按存储的类型初始化下拉', async () => {
    const onSave = vi.fn();
    renderModal({
      provider: {
        ...baseProvider,
        name: 'My Key',
        apiKey: 'sk-test123',
        models: ['gpt-4o'],
        model_types: { 'gpt-4o': 'llm' },
      },
      onSave,
    });

    const typeSelect = screen.getByRole('combobox', {
      name: 'gpt-4o 类型',
    }) as HTMLSelectElement;
    expect(typeSelect.value).toBe('llm');

    fireEvent.click(await screen.findByText('Save'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ model_types: { 'gpt-4o': 'llm' } }),
    );
  });

  it('模型列表容器带滚动样式', async () => {
    mockFetchModels.mockResolvedValue({
      success: true,
      models: ['gpt-4'],
      types: { 'gpt-4': 'llm' },
    });
    renderModal({ provider: { ...baseProvider, apiKey: 'sk-test' } });

    fireEvent.click(await screen.findByTitle('Fetch'));
    await waitFor(() => expect(screen.getByText('gpt-4')).toBeInTheDocument());

    const list = screen.getByText('gpt-4').closest('div')?.parentElement;
    expect(list?.className).toContain('max-h-64');
    expect(list?.className).toContain('overflow-y-auto');
  });
});
