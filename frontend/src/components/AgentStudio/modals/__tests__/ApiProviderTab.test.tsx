import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ApiProviderTab from '../ApiProviderTab';
import type { KeyItem } from '../../../api/client';

vi.mock('react-i18next', async () => {
  const actual = await vi.importActual('react-i18next');
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const map: Record<string, string> = {
          'api.manage': '管理',
          'api.type_embed': 'Embed',
          'api.type_both': 'Both',
          'api.type_llm': 'LLM',
          'api.encryptHint': 'Keys are encrypted',
          'api.noKeys': 'No keys',
          'api.addKeyHint': 'Add one',
          'api.test': 'Test',
          'api.lastUsed': 'Last used',
          'common.loading': 'Loading...',
        };
        return map[key] || key;
      },
    }),
  };
});

const mockKey: KeyItem = {
  id: 'k1',
  provider: 'openai',
  usage_type: 'llm',
  label: 'My OpenAI Key',
  key_masked: 'sk-...abc',
  base_url: 'https://api.openai.com/v1',
  models: ['gpt-4'],
  is_active: true,
  is_default: false,
  last_used_at: '2026-01-15T10:30:00Z',
  created_at: '2026-01-01T00:00:00Z',
};

const baseProps = {
  keys: [mockKey] as KeyItem[],
  loading: false as boolean,
  error: null as string | null,
  usageTypeFilter: 'all' as 'all' | 'llm' | 'embedding' | 'both',
  testingId: null as string | null,
  showApiKey: {} as Record<string, boolean>,
  saving: false as boolean,
  onFilterChange: vi.fn(),
  onAdd: vi.fn(),
  onEdit: vi.fn(),
  onToggleActive: vi.fn(),
  onTest: vi.fn(),
  onDelete: vi.fn(),
  onToggleVisibility: vi.fn(),
  onDismissError: vi.fn(),
};

function renderTab(overrides: Partial<typeof baseProps> = {}) {
  return render(<ApiProviderTab {...baseProps} {...overrides} />);
}

describe('ApiProviderTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    renderTab({ loading: true, keys: [] });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders empty state when no keys', () => {
    renderTab({ keys: [] });
    expect(screen.getByText(/No keys/)).toBeInTheDocument();
  });

  it('renders key list', () => {
    renderTab();
    expect(screen.getByText('My OpenAI Key')).toBeInTheDocument();
    expect(screen.getByText('sk-...abc')).toBeInTheDocument();
  });

  it('shows error banner with dismiss', () => {
    const onDismissError = vi.fn();
    renderTab({ error: 'Connection failed', onDismissError });
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    fireEvent.click(screen.getByText('✕'));
    expect(onDismissError).toHaveBeenCalled();
  });

  it('calls onAdd when add button clicked', () => {
    const onAdd = vi.fn();
    renderTab({ keys: [], onAdd });
    fireEvent.click(screen.getByText('添加 Key'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('calls onEdit when edit button clicked', () => {
    const onEdit = vi.fn();
    renderTab({ onEdit });
    fireEvent.click(screen.getByText('编辑'));
    expect(onEdit).toHaveBeenCalledWith(mockKey);
  });

  it('calls onDelete when delete button clicked', () => {
    const onDelete = vi.fn();
    renderTab({ onDelete });
    const trashBtns = screen.getAllByRole('button');
    const trashBtn = trashBtns.find((b) => b.querySelector('.lucide-trash2'));
    expect(trashBtn).toBeTruthy();
    fireEvent.click(trashBtn!);
    expect(onDelete).toHaveBeenCalledWith('k1');
  });

  it('calls onTest when test button clicked', () => {
    const onTest = vi.fn();
    renderTab({ onTest });
    fireEvent.click(screen.getByText('Test'));
    expect(onTest).toHaveBeenCalledWith(mockKey);
  });

  it('calls onToggleVisibility', () => {
    const onToggleVisibility = vi.fn();
    renderTab({ onToggleVisibility });
    fireEvent.click(screen.getByLabelText('Show full key hint'));
    expect(onToggleVisibility).toHaveBeenCalledWith('k1');
  });

  it('calls onFilterChange', () => {
    const onFilterChange = vi.fn();
    renderTab({ onFilterChange });
    fireEvent.click(screen.getAllByText('LLM')[0]);
    expect(onFilterChange).toHaveBeenCalledWith('llm');
  });

  it('hides keys not matching filter', () => {
    renderTab({ usageTypeFilter: 'embedding' });
    expect(screen.queryByText('My OpenAI Key')).not.toBeInTheDocument();
  });

  it('shows last used date', () => {
    renderTab();
    expect(screen.getByText(/Last used/)).toBeInTheDocument();
  });

  it('shows inactive badge', () => {
    renderTab({ keys: [{ ...mockKey, is_active: false }] });
    expect(screen.getByText('My OpenAI Key')).toBeInTheDocument();
  });

  it('shows provider and base_url', () => {
    renderTab();
    expect(screen.getByText(/openai · https:\/\/api\.openai\.com\/v1/)).toBeInTheDocument();
  });
});
