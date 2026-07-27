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
          'api.type_vector': 'Vector',
          'api.type_general': 'General',
          'api.type_chat': 'Chat',
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
  testingId: null as string | null,
  saving: false as boolean,
  onAdd: vi.fn(),
  onEdit: vi.fn(),
  onToggleActive: vi.fn(),
  onTest: vi.fn(),
  onDelete: vi.fn(),
  onDismissError: vi.fn(),
};

function renderTab(overrides: Partial<typeof baseProps> = {}) {
  return render(<ApiProviderTab {...baseProps} {...overrides} />);
}

describe('ApiProviderTab', { tags: ['integration'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    renderTab({ loading: true, keys: [] });
    expect(document.querySelector('.ant-spin')).toBeTruthy();
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
    const editBtn = document.querySelector('.lucide-pencil')?.closest('button');
    expect(editBtn).toBeTruthy();
    fireEvent.click(editBtn!);
    expect(onEdit).toHaveBeenCalledWith(mockKey);
  });

  it('calls onDelete when delete button clicked', () => {
    const onDelete = vi.fn();
    renderTab({ onDelete });
    const trashBtn = document.querySelector('.lucide-trash2')?.closest('button');
    expect(trashBtn).toBeTruthy();
    fireEvent.click(trashBtn!);
    expect(onDelete).toHaveBeenCalledWith('k1');
  });

  it('calls onTest when test button clicked', () => {
    const onTest = vi.fn();
    renderTab({ onTest });
    const testBtn = document.querySelector('.lucide-refresh-cw')?.closest('button');
    expect(testBtn).toBeTruthy();
    fireEvent.click(testBtn!);
    expect(onTest).toHaveBeenCalledWith(mockKey);
  });

  it('shows last used date header', () => {
    renderTab();
    expect(screen.getByText('上次使用')).toBeInTheDocument();
  });

  it('shows inactive badge', () => {
    renderTab({ keys: [{ ...mockKey, is_active: false }] });
    expect(screen.getByText('My OpenAI Key')).toBeInTheDocument();
  });
});
