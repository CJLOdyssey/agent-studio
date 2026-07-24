import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
          'providerEdit.provider': 'Provider',
          'providerEdit.name': 'Name',
          'providerEdit.nameOptional': 'optional',
          'providerEdit.baseUrl': 'Base URL',
          'providerEdit.apiKey': 'API Key',
          'providerEdit.supportedModels': 'Models',
          'providerEdit.save': 'Save',
          'providerEdit.placeholders.name': 'Enter name',
          'providerEdit.placeholders.baseUrl': 'https://...',
          'providerEdit.placeholders.apiKey': 'sk-...',
          'providerEdit.nameHint': 'Hint text',
          'workstation.capabilities': 'Capabilities',
          'workstation.purpose': 'Purpose',
          'workstation.bothSupported': 'Both',
          'workstation.fetchingModels': 'Fetching...',
          'workstation.enterApiKeyToFetch': 'Enter API key',
          'workstation.fetchFromApi': 'Fetch',
          'confirm.cancel': 'Cancel',
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
    openai: { name: 'OpenAI', base_url: 'https://api.openai.com/v1', capabilities: ['llm', 'embedding'], docs_url: null },
    custom: { name: 'Custom', base_url: '', capabilities: ['llm', 'embedding'], docs_url: null },
  }),
}));

import ProviderEditModal, { type ApiProviderForm } from '../ProviderEditModal';

const baseProvider: ApiProviderForm = {
  id: '',
  provider: 'openai',
  usage_type: 'llm',
  name: '',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  models: [],
  isActive: true,
};

function renderModal(overrides: { provider?: ApiProviderForm; saving?: boolean; onSave?: ReturnType<typeof vi.fn>; onClose?: ReturnType<typeof vi.fn> } = {}) {
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal with add title', async () => {
    renderModal();
    expect(await screen.findByText('Add Provider')).toBeInTheDocument();
  });

  it('renders edit title when provider has id', async () => {
    renderModal({ provider: { ...baseProvider, id: 'pk_1' } });
    expect(await screen.findByText('Edit Provider')).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    fireEvent.click(await screen.findByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay is clicked', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    const overlay = document.querySelector('.modal-overlay')!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('toggles API key visibility', async () => {
    renderModal();
    await screen.findByText('Add Provider');
    const apiKeyInput = screen.getByPlaceholderText('sk-...');
    expect(apiKeyInput).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByLabelText('Show API key'));
    expect(apiKeyInput).toHaveAttribute('type', 'text');
  });

  it('calls onSave with form data', async () => {
    const onSave = vi.fn();
    renderModal({ provider: { ...baseProvider, name: 'My Key', apiKey: 'sk-test123' }, onSave });
    fireEvent.click(await screen.findByText('Save'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'My Key', apiKey: 'sk-test123' }),
    );
  });

  it('save button is disabled when name is empty', async () => {
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

  it('shows loading spinner when saving', async () => {
    renderModal({ saving: true });
    expect(await screen.findByText('...')).toBeInTheDocument();
  });

  it('stops propagation on modal content click', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    const content = document.querySelector('.modal-content')!;
    fireEvent.click(content);
    expect(onClose).not.toHaveBeenCalled();
  });
});
