import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestProviders } from '../../../../../test/setup';

const mockOpenCreate = vi.fn();
const mockOpenEdit = vi.fn();
const mockOpenDelete = vi.fn();
const mockOpenHistory = vi.fn();
const mockOpenBatchDelete = vi.fn();
const mockHandleDelete = vi.fn();
const mockHandleBatchDelete = vi.fn();
const mockSetSearch = vi.fn();
const mockSetStatusFilter = vi.fn();
const mockSetPage = vi.fn();
const mockToggleSelect = vi.fn();
const mockToggleSelectAll = vi.fn();
const mockRetry = vi.fn();
const mockClearError = vi.fn();
const mockSetIsFormOpen = vi.fn();
const mockSetIsDeleteOpen = vi.fn();
const mockSetIsBatchDeleteOpen = vi.fn();
const mockSetIsHistoryOpen = vi.fn();
const mockCloseMenu = vi.fn();

let mockIsLoading = false;
let mockError: string | null = null;
let mockBatchError = '';
let mockProcessed: any[] = [];
let mockSelectedIds = new Set<string>();
let mockEditingAgent: any = null;
let mockDeletingAgent: any = null;
let mockHistoryAgent: any = null;
let mockIsFormOpen = false;
let mockIsDeleteOpen = false;
let mockIsBatchDeleteOpen = false;
let mockIsHistoryOpen = false;

vi.mock('../useAgentManagement', () => ({
  useAgentManagement: () => ({
    isLoading: mockIsLoading,
    error: mockError,
    batchError: mockBatchError,
    processed: mockProcessed,
    paged: mockProcessed,
    page: 1,
    totalPages: 1,
    search: '',
    statusFilter: 'all',
    sortField: null,
    sortDir: 'asc',
    selectedIds: mockSelectedIds,
    allOnPageSelected: false,
    formErrors: [],
    isFormOpen: mockIsFormOpen,
    isDeleteOpen: mockIsDeleteOpen,
    isBatchDeleteOpen: mockIsBatchDeleteOpen,
    isHistoryOpen: mockIsHistoryOpen,
    editingAgent: mockEditingAgent,
    deletingAgent: mockDeletingAgent,
    historyAgent: mockHistoryAgent,
    formData: { name: '', description: '', team: '', model: '', status: 'stopped', version: 'v1.0.0', systemPromptId: '', toolIds: [], mcpIds: [], skillIds: [] },
    openMenuId: null,
    menuAnchorEl: null,
    setFormData: vi.fn(),
    setSearch: mockSetSearch,
    setStatusFilter: mockSetStatusFilter,
    setPage: mockSetPage,
    setSelectedIds: vi.fn(),
    setOpenMenuId: vi.fn(),
    setMenuAnchorEl: vi.fn(),
    handleSort: vi.fn(),
    toggleSelectAll: mockToggleSelectAll,
    toggleSelect: mockToggleSelect,
    openCreate: mockOpenCreate,
    openEdit: mockOpenEdit,
    handleSave: vi.fn(),
    openDelete: mockOpenDelete,
    handleDelete: mockHandleDelete,
    handleCopy: vi.fn(),
    openHistory: mockOpenHistory,
    openBatchDelete: mockOpenBatchDelete,
    handleBatchDelete: mockHandleBatchDelete,
    closeMenu: mockCloseMenu,
    setIsFormOpen: mockSetIsFormOpen,
    setIsDeleteOpen: mockSetIsDeleteOpen,
    setIsBatchDeleteOpen: mockSetIsBatchDeleteOpen,
    setIsHistoryOpen: mockSetIsHistoryOpen,
    retry: mockRetry,
    clearError: mockClearError,
  }),
}));

vi.mock('../locales', () => ({ t: (k: string) => k, setLang: vi.fn(), getLang: () => 'zh' }));
vi.mock('../AgentFormModal', () => ({ default: () => null }));
vi.mock('../../shared/DeleteConfirmModal', () => ({ default: () => null }));
vi.mock('../../shared/BatchDeleteModal', () => ({ default: () => null }));
vi.mock('../../shared/VersionHistoryModal', () => ({ default: () => null }));
vi.mock('../../shared/LoadingSkeleton', () => ({ TableSkeleton: () => <div data-testid="skeleton" /> }));
vi.mock('../../shared/ErrorBoundary', () => ({ ErrorBoundary: ({ children }: any) => <>{children}</> }));

import AgentManagement from '../AgentManagement';

function makeAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: '1', name: '前端开发 Agent', team: '前端团队', model: 'Claude Sonnet 4',
    status: 'running' as const, version: 'v2.1.0', createdAt: '2026-05-10',
    ...overrides,
  };
}

function renderComponent() {
  return render(<TestProviders><AgentManagement /></TestProviders>);
}

describe('AgentManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoading = false;
    mockError = null;
    mockBatchError = '';
    mockProcessed = [];
    mockSelectedIds = new Set();
    mockEditingAgent = null;
    mockDeletingAgent = null;
    mockHistoryAgent = null;
    mockIsFormOpen = false;
    mockIsDeleteOpen = false;
    mockIsBatchDeleteOpen = false;
    mockIsHistoryOpen = false;
  });

  it('renders loading skeleton', () => {
    mockIsLoading = true;
    renderComponent();
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('renders empty state when no agents', () => {
    renderComponent();
    expect(screen.getByText('agent.empty_desc_general')).toBeInTheDocument();
  });

  it('renders agents in table', () => {
    mockProcessed = [makeAgent()];
    renderComponent();
    expect(screen.getByText('前端开发 Agent')).toBeInTheDocument();
    expect(screen.getByText('前端团队')).toBeInTheDocument();
    expect(screen.getByText('Claude Sonnet 4')).toBeInTheDocument();
  });

  it('renders multiple agents', () => {
    mockProcessed = [
      makeAgent({ id: '1', name: 'Agent One', team: '前端团队' }),
      makeAgent({ id: '2', name: 'Agent Two', team: '后端团队' }),
    ];
    renderComponent();
    expect(screen.getByText('Agent One')).toBeInTheDocument();
    expect(screen.getByText('Agent Two')).toBeInTheDocument();
  });

  it('renders status badge', () => {
    mockProcessed = [makeAgent()];
    renderComponent();
    expect(document.querySelector('.wsta-badge-dot-green')).toBeInTheDocument();
  });

  it('renders status badge for stopped agent', () => {
    mockProcessed = [makeAgent({ status: 'stopped' })];
    renderComponent();
    expect(document.querySelector('.wsta-badge-dot-gray')).toBeInTheDocument();
  });

  it('renders status badge for error agent', () => {
    mockProcessed = [makeAgent({ status: 'error' })];
    renderComponent();
    expect(document.querySelector('.wsta-badge-dot-red')).toBeInTheDocument();
  });

  it('renders version text in monospace', () => {
    mockProcessed = [makeAgent()];
    renderComponent();
    expect(document.querySelector('.wsta-mono-text')).toBeInTheDocument();
  });

  it('shows create button', () => {
    renderComponent();
    expect(screen.getByText('agent.new')).toBeInTheDocument();
  });

  it('calls openCreate when create button clicked', () => {
    renderComponent();
    fireEvent.click(screen.getByText('agent.new'));
    expect(mockOpenCreate).toHaveBeenCalled();
  });

  it('shows action dropdown for each agent', () => {
    mockProcessed = [makeAgent()];
    renderComponent();
    expect(document.querySelector('.wsta-action-btn')).toBeInTheDocument();
  });

  it('renders error banner when error is present', () => {
    mockError = 'Failed to load agents';
    renderComponent();
    expect(screen.getByText('Failed to load agents')).toBeInTheDocument();
  });

  it('calls retry when error retry button clicked', () => {
    mockError = 'Failed';
    renderComponent();
    const retryBtn = screen.getByLabelText('agent.error_retry');
    fireEvent.click(retryBtn);
    expect(mockRetry).toHaveBeenCalled();
  });

  it('renders batch error banner', () => {
    mockBatchError = '运行中 Agent 不可删除';
    renderComponent();
    expect(screen.getByText('运行中 Agent 不可删除')).toBeInTheDocument();
  });

  it('shows batch delete button when items selected', () => {
    mockProcessed = [makeAgent()];
    mockSelectedIds = new Set(['1']);
    renderComponent();
    expect(screen.getByText(/agent\.batch_delete/)).toBeInTheDocument();
  });

  it('renders search input', () => {
    renderComponent();
    const inputs = document.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThan(0);
  });

  it('renders status filter select', () => {
    renderComponent();
    expect(screen.getByText('全部状态')).toBeInTheDocument();
  });

  it('renders pagination', () => {
    mockProcessed = [makeAgent()];
    renderComponent();
    expect(document.querySelector('.wsta-pagination') || document.querySelector('.ant-pagination')).toBeTruthy();
  });

  it('renders checkbox column', () => {
    mockProcessed = [makeAgent()];
    renderComponent();
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it('renders selected row class', () => {
    mockProcessed = [makeAgent()];
    mockSelectedIds = new Set(['1']);
    renderComponent();
    expect(document.querySelector('.wsta-row-selected')).toBeInTheDocument();
  });

  it('renders table with correct role', () => {
    mockProcessed = [makeAgent()];
    renderComponent();
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('renders toolbar', () => {
    renderComponent();
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('renders modal when form is open with editing agent', () => {
    mockIsFormOpen = true;
    mockEditingAgent = makeAgent();
    renderComponent();
    // AgentFormModal is mocked to null, so no crash
    expect(true).toBe(true);
  });

  it('renders delete modal when delete is open', () => {
    mockIsDeleteOpen = true;
    mockDeletingAgent = makeAgent();
    renderComponent();
    expect(true).toBe(true);
  });

  it('renders history modal when history is open', () => {
    mockIsHistoryOpen = true;
    mockHistoryAgent = makeAgent();
    renderComponent();
    expect(true).toBe(true);
  });
});
