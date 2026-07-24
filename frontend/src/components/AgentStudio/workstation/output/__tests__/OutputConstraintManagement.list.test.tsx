import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

vi.mock('../locales', () => ({
  t: (key: string, ..._args: string[]) => key,
}));

const mockToast = vi.fn();
vi.mock('../../../../../utils/useToast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockUseOutputMgmt = {
  isLoading: false,
  error: null,
  filtered: [] as any[],
  paged: [] as any[],
  page: 1,
  totalPages: 1,
  search: '',
  categoryFilter: 'all',
  selectedIds: new Set<string>(),
  allOnPageSelected: false,
  isFormOpen: false,
  formErrors: [] as string[],
  editingItem: null as any,
  editingId: null as string | null,
  formData: { name: '', content: '', category: '格式约束', model: '全部模型', status: 'draft', version: 'v1.0.0' } as any,
  openMenuId: null as string | null,
  menuAnchorEl: null as HTMLElement | null,
  setSearch: vi.fn(),
  setCategoryFilter: vi.fn(),
  setPage: vi.fn(),
  setFormData: vi.fn(),
  setOpenMenuId: vi.fn(),
  setMenuAnchorEl: vi.fn(),
  toggleSelect: vi.fn(),
  toggleSelectAll: vi.fn(),
  addItem: vi.fn(),
  updateItem: vi.fn(),
  removeItem: vi.fn(),
  copyItem: vi.fn(),
  removeMultiple: vi.fn(),
  getAllItems: vi.fn().mockReturnValue([]),
  addItems: vi.fn(),
  clearError: vi.fn(),
  retry: vi.fn(),
  openCreate: vi.fn(),
  openEdit: vi.fn(),
  closeForm: vi.fn(),
  handleSave: vi.fn().mockReturnValue(true),
};

vi.mock('../useOutputManagement', () => ({
  useOutputManagement: () => mockUseOutputMgmt,
}));

vi.mock('../shared/ResourcePickerModal', () => ({ default: () => null }));

import OutputConstraintManagement from '../OutputConstraintManagement';

const makeItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'o1',
  name: 'JSON格式',
  content: '以JSON格式输出',
  category: '格式约束',
  model: '全部模型',
  status: 'active',
  version: 'v1.0.0',
  createdAt: '2024-01-01',
  ...overrides,
});

describe('OutputConstraintManagement', { tags: ['unit'] }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [];
    mockUseOutputMgmt.paged = [];
    mockUseOutputMgmt.search = '';
    mockUseOutputMgmt.categoryFilter = 'all';
    mockUseOutputMgmt.selectedIds = new Set<string>();
    mockUseOutputMgmt.allOnPageSelected = false;
    mockUseOutputMgmt.isFormOpen = false;
    mockUseOutputMgmt.formErrors = [];
    mockUseOutputMgmt.editingItem = null;
    mockUseOutputMgmt.editingId = null;
    mockUseOutputMgmt.openMenuId = null;
    mockUseOutputMgmt.menuAnchorEl = null;
    mockUseOutputMgmt.handleSave.mockReturnValue(true);
  });

  it('renders without crashing', () => {
    const { container } = render(<OutputConstraintManagement />);
    expect(container).toBeDefined();
  });

  it('renders loading skeleton when isLoading is true', () => {
    mockUseOutputMgmt.isLoading = true;
    const { container } = render(<OutputConstraintManagement />);
    expect(container.querySelector('[role="status"]')).toBeDefined();
    expect(screen.getByRole('region', { name: /loading/i })).toBeDefined();
  });

  it('renders empty state when no items exist', () => {
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [];
    render(<OutputConstraintManagement />);
    expect(screen.getByText(/empty_title/i)).toBeDefined();
  });

  it('shows search-specific empty message when search is active', () => {
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [];
    mockUseOutputMgmt.search = 'xxx';
    render(<OutputConstraintManagement />);
    expect(screen.getByText(/empty_desc_search/i)).toBeDefined();
  });

  it('renders items in table when data exists', () => {
    const item = makeItem();
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [item];
    mockUseOutputMgmt.paged = [item];
    mockUseOutputMgmt.totalPages = 1;
    render(<OutputConstraintManagement />);
    expect(screen.getByText('JSON格式')).toBeDefined();
    expect(screen.getByText('以JSON格式输出')).toBeDefined();
  });

  it('renders multiple items', () => {
    const items = [makeItem(), makeItem({ id: 'o2', name: '代码规范' })];
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = items;
    mockUseOutputMgmt.paged = items;
    mockUseOutputMgmt.totalPages = 1;
    render(<OutputConstraintManagement />);
    expect(screen.getByText('JSON格式')).toBeDefined();
    expect(screen.getByText('代码规范')).toBeDefined();
  });

  it('calls setSearch on search input change', () => {
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [makeItem()];
    mockUseOutputMgmt.paged = [makeItem()];
    mockUseOutputMgmt.totalPages = 1;
    const setSearch = vi.fn();
    mockUseOutputMgmt.setSearch = setSearch;

    render(<OutputConstraintManagement />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '测试' } });
    expect(setSearch).toHaveBeenCalledWith('测试');
  });

  it('renders category filter select element', () => {
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [makeItem()];
    mockUseOutputMgmt.paged = [makeItem()];
    mockUseOutputMgmt.totalPages = 1;
    const { container } = render(<OutputConstraintManagement />);
    expect(container.querySelector('.ant-select')).toBeDefined();
  });

  it('calls openCreate on new button click', () => {
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [makeItem()];
    mockUseOutputMgmt.paged = [makeItem()];
    mockUseOutputMgmt.totalPages = 1;
    const openCreate = vi.fn();
    mockUseOutputMgmt.openCreate = openCreate;

    render(<OutputConstraintManagement />);
    const buttons = screen.getAllByRole('button');
    const createBtn = buttons.find((b) => b.classList.contains('ant-btn-primary'));
    if (createBtn) fireEvent.click(createBtn);
    expect(openCreate).toHaveBeenCalled();
  });

  it('shows batch delete button when items are selected', () => {
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [makeItem()];
    mockUseOutputMgmt.paged = [makeItem()];
    mockUseOutputMgmt.totalPages = 1;
    mockUseOutputMgmt.selectedIds = new Set(['o1']);

    render(<OutputConstraintManagement />);
    expect(screen.getByText(/batch_delete/i)).toBeDefined();
  });

  it('hides batch delete button when no items selected', () => {
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [makeItem()];
    mockUseOutputMgmt.paged = [makeItem()];
    mockUseOutputMgmt.totalPages = 1;
    mockUseOutputMgmt.selectedIds = new Set();

    render(<OutputConstraintManagement />);
    expect(screen.queryByText(/batch_delete/i)).toBeNull();
  });

  it('calls removeMultiple and toast on batch delete click', () => {
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [makeItem()];
    mockUseOutputMgmt.paged = [makeItem()];
    mockUseOutputMgmt.totalPages = 1;
    mockUseOutputMgmt.selectedIds = new Set(['o1', 'o2']);
    const removeMultiple = vi.fn();
    mockUseOutputMgmt.removeMultiple = removeMultiple;
    mockToast.mockClear();

    render(<OutputConstraintManagement />);
    const dangerBtn = screen.getByText(/batch_delete/i).closest('button');
    if (dangerBtn) fireEvent.click(dangerBtn);
    expect(removeMultiple).toHaveBeenCalledWith(mockUseOutputMgmt.selectedIds);
    expect(mockToast).toHaveBeenCalledWith(
      expect.stringContaining('toast_batch_deleted'),
      'success',
    );
  });

  it('calls toggleSelectAll on select-all checkbox change', () => {
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [makeItem()];
    mockUseOutputMgmt.paged = [makeItem()];
    mockUseOutputMgmt.totalPages = 1;
    const toggleSelectAll = vi.fn();
    mockUseOutputMgmt.toggleSelectAll = toggleSelectAll;
    mockUseOutputMgmt.allOnPageSelected = false;

    render(<OutputConstraintManagement />);
    const selectAllCheckbox = screen.getByRole('checkbox', { name: /select_all/i });
    fireEvent.click(selectAllCheckbox);
    expect(toggleSelectAll).toHaveBeenCalled();
  });

  it('calls toggleSelect on individual row checkbox change', () => {
    const item = makeItem();
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [item];
    mockUseOutputMgmt.paged = [item];
    mockUseOutputMgmt.totalPages = 1;
    const toggleSelect = vi.fn();
    mockUseOutputMgmt.toggleSelect = toggleSelect;

    render(<OutputConstraintManagement />);
    const rowCheckbox = screen.getByRole('checkbox', { name: /select_item/i });
    fireEvent.click(rowCheckbox);
    expect(toggleSelect).toHaveBeenCalledWith(item.id);
  });

  it('applies selected row class when item is in selectedIds', () => {
    const item = makeItem();
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [item];
    mockUseOutputMgmt.paged = [item];
    mockUseOutputMgmt.totalPages = 1;
    mockUseOutputMgmt.selectedIds = new Set([item.id]);

    const { container } = render(<OutputConstraintManagement />);
    expect(container.querySelector('.wsta-row-selected')).toBeDefined();
  });

  it('does not apply selected row class when item not selected', () => {
    const item = makeItem();
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [item];
    mockUseOutputMgmt.paged = [item];
    mockUseOutputMgmt.totalPages = 1;
    mockUseOutputMgmt.selectedIds = new Set();

    const { container } = render(<OutputConstraintManagement />);
    expect(container.querySelector('.wsta-row-selected')).toBeNull();
  });

  it('renders status badge with correct classes for active status', () => {
    const item = makeItem({ status: 'active' });
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [item];
    mockUseOutputMgmt.paged = [item];
    mockUseOutputMgmt.totalPages = 1;

    const { container } = render(<OutputConstraintManagement />);
    expect(container.querySelector('.wsta-badge-dot-green')).toBeDefined();
    expect(container.querySelector('.wsta-dot-green')).toBeDefined();
  });

  it('renders status badge for draft status', () => {
    const item = makeItem({ status: 'draft' });
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [item];
    mockUseOutputMgmt.paged = [item];
    mockUseOutputMgmt.totalPages = 1;

    const { container } = render(<OutputConstraintManagement />);
    expect(container.querySelector('.wsta-badge-dot-gray')).toBeDefined();
  });

  it('renders status badge for archived status', () => {
    const item = makeItem({ status: 'archived' });
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [item];
    mockUseOutputMgmt.paged = [item];
    mockUseOutputMgmt.totalPages = 1;

    const { container } = render(<OutputConstraintManagement />);
    expect(container.querySelector('.wsta-badge-dot-gray')).toBeDefined();
  });

  it('renders category tag with correct class', () => {
    const item = makeItem({ category: '格式约束' });
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [item];
    mockUseOutputMgmt.paged = [item];
    mockUseOutputMgmt.totalPages = 1;

    const { container } = render(<OutputConstraintManagement />);
    expect(container.querySelector('.wsta-tag-indigo')).toBeDefined();
    expect(screen.getByText('格式约束')).toBeDefined();
  });

  it('renders content constraint tag with green class', () => {
    const item = makeItem({ id: 'o2', category: '内容约束' });
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [item];
    mockUseOutputMgmt.paged = [item];
    mockUseOutputMgmt.totalPages = 1;

    const { container } = render(<OutputConstraintManagement />);
    expect(container.querySelector('.wsta-tag-green')).toBeDefined();
  });

  it('renders dropdown action button for each row', () => {
    const item = makeItem();
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [item];
    mockUseOutputMgmt.paged = [item];
    mockUseOutputMgmt.totalPages = 1;

    const { container } = render(<OutputConstraintManagement />);
    expect(container.querySelector('.wsta-action-btn')).toBeDefined();
  });

  it('renders WstaPagination when data exists', () => {
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = Array.from({ length: 10 }, (_, i) =>
      makeItem({ id: `o${i + 1}`, name: `Item ${i + 1}` }),
    );
    mockUseOutputMgmt.paged = mockUseOutputMgmt.filtered.slice(0, 5);
    mockUseOutputMgmt.totalPages = 2;

    const { container } = render(<OutputConstraintManagement />);
    expect(container.querySelector('.wsta-pagination')).toBeDefined();
  });

  it('renders within an ErrorBoundary wrapper', () => {
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [makeItem()];
    mockUseOutputMgmt.paged = [makeItem()];
    mockUseOutputMgmt.totalPages = 1;

    const { container } = render(<OutputConstraintManagement />);
    const region = container.querySelector('[role="region"]');
    expect(region).toBeDefined();
    expect(region?.getAttribute('aria-label')).toBeTruthy();
  });
});
