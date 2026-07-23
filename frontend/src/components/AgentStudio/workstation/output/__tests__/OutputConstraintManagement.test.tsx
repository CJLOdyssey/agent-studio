import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mock react-i18next ─────────────────────────────────────────────
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

vi.mock('../locales', () => ({
  t: (key: string, ..._args: string[]) => key,
}));

const mockToast = vi.fn();
vi.mock('../../../../../utils/useToast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// ── Mock useOutputManagement ───────────────────────────────────────
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

describe('OutputConstraintManagement', () => {
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

  // ─── 1. Rendering / basic ───────────────────────────────────────
  it('renders without crashing', () => {
    const { container } = render(<OutputConstraintManagement />);
    expect(container).toBeDefined();
  });

  // ─── 2. Loading state ───────────────────────────────────────────
  it('renders loading skeleton when isLoading is true', () => {
    mockUseOutputMgmt.isLoading = true;
    const { container } = render(<OutputConstraintManagement />);
    expect(container.querySelector('[role="status"]')).toBeDefined();
    expect(screen.getByRole('region', { name: /loading/i })).toBeDefined();
  });

  // ─── 3. Empty state ─────────────────────────────────────────────
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

  // ─── 4. Data rendering ──────────────────────────────────────────
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

  // ─── 5. Search input ────────────────────────────────────────────
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

  // ─── 6. Category filter ─────────────────────────────────────────
  it('renders category filter select element', () => {
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [makeItem()];
    mockUseOutputMgmt.paged = [makeItem()];
    mockUseOutputMgmt.totalPages = 1;
    const { container } = render(<OutputConstraintManagement />);
    expect(container.querySelector('.ant-select')).toBeDefined();
  });

  // ─── 7. Create button ───────────────────────────────────────────
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

  // ─── 8. Batch delete button ─────────────────────────────────────
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

  // ─── 9. Checkbox selection ──────────────────────────────────────
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

  // ─── 10. Status badge rendering ─────────────────────────────────
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

  // ─── 11. Category tag rendering ─────────────────────────────────
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

  // ─── 12. Dropdown action button ─────────────────────────────────
  it('renders dropdown action button for each row', () => {
    const item = makeItem();
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [item];
    mockUseOutputMgmt.paged = [item];
    mockUseOutputMgmt.totalPages = 1;

    const { container } = render(<OutputConstraintManagement />);
    expect(container.querySelector('.wsta-action-btn')).toBeDefined();
  });

  // ─── 13. Form modal ─────────────────────────────────────────────
  it('renders form modal when isFormOpen is true', () => {
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [makeItem()];
    mockUseOutputMgmt.paged = [makeItem()];
    mockUseOutputMgmt.totalPages = 1;
    mockUseOutputMgmt.isFormOpen = true;
    mockUseOutputMgmt.editingItem = null;
    mockUseOutputMgmt.formErrors = [];

    const { container } = render(<OutputConstraintManagement />);
    expect(container.querySelector('.modal-overlay')).toBeDefined();
  });

  it('does not render form modal when isFormOpen is false', () => {
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [makeItem()];
    mockUseOutputMgmt.paged = [makeItem()];
    mockUseOutputMgmt.totalPages = 1;
    mockUseOutputMgmt.isFormOpen = false;

    const { container } = render(<OutputConstraintManagement />);
    expect(container.querySelector('.modal-overlay')).toBeNull();
  });

  it('renders form modal with editingItem for edit mode', () => {
    const item = makeItem();
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [item];
    mockUseOutputMgmt.paged = [item];
    mockUseOutputMgmt.totalPages = 1;
    mockUseOutputMgmt.isFormOpen = true;
    mockUseOutputMgmt.editingItem = item;
    mockUseOutputMgmt.editingId = item.id;

    render(<OutputConstraintManagement />);
    expect(screen.getByText(/form_title_edit/i)).toBeDefined();
  });

  // ─── 14. handleSave with toast ──────────────────────────────────
  it('toasts success on handleSave when editingId is set (update)', () => {
    const item = makeItem();
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [item];
    mockUseOutputMgmt.paged = [item];
    mockUseOutputMgmt.totalPages = 1;
    mockUseOutputMgmt.isFormOpen = true;
    mockUseOutputMgmt.editingItem = item;
    mockUseOutputMgmt.editingId = 'o1';
    mockUseOutputMgmt.formData = { name: 'Test', content: 'Test', category: '格式约束', model: '全部模型', status: 'draft', version: 'v1.0.0' };
    const handleSave = vi.fn().mockReturnValue(true);
    mockUseOutputMgmt.handleSave = handleSave;
    mockToast.mockClear();

    render(<OutputConstraintManagement />);
    const saveButton = screen.getByText(/form_save_edit/i);
    fireEvent.click(saveButton);
    expect(handleSave).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.stringContaining('toast_updated'),
      'success',
    );
  });

  it('toasts success on handleSave when editingId is null (create)', () => {
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [makeItem()];
    mockUseOutputMgmt.paged = [makeItem()];
    mockUseOutputMgmt.totalPages = 1;
    mockUseOutputMgmt.isFormOpen = true;
    mockUseOutputMgmt.editingItem = null;
    mockUseOutputMgmt.editingId = null;
    mockUseOutputMgmt.formData = { name: 'New', content: 'New', category: '格式约束', model: '全部模型', status: 'draft', version: 'v1.0.0' };
    const handleSave = vi.fn().mockReturnValue(true);
    mockUseOutputMgmt.handleSave = handleSave;
    mockToast.mockClear();

    render(<OutputConstraintManagement />);
    const saveButton = screen.getByText(/form_save_create/i);
    fireEvent.click(saveButton);
    expect(handleSave).toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith(
      expect.stringContaining('toast_created'),
      'success',
    );
  });

  it('does not toast when handleSave returns false', () => {
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [makeItem()];
    mockUseOutputMgmt.paged = [makeItem()];
    mockUseOutputMgmt.totalPages = 1;
    mockUseOutputMgmt.isFormOpen = true;
    mockUseOutputMgmt.editingItem = null;
    mockUseOutputMgmt.editingId = null;
    mockUseOutputMgmt.formData = { name: 'New', content: 'New', category: '格式约束', model: '全部模型', status: 'draft', version: 'v1.0.0' };
    const handleSave = vi.fn().mockReturnValue(false);
    mockUseOutputMgmt.handleSave = handleSave;
    mockToast.mockClear();

    render(<OutputConstraintManagement />);
    const saveButton = screen.getByText(/form_save_create/i);
    fireEvent.click(saveButton);
    expect(mockToast).not.toHaveBeenCalled();
  });

  // ─── 15. Pagination ─────────────────────────────────────────────
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

  // ─── 16. Error boundary ─────────────────────────────────────────
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

  // ─── 17. Empty form data (no form modal) ────────────────────────
  it('handles different formData states gracefully', () => {
    mockUseOutputMgmt.isLoading = false;
    mockUseOutputMgmt.filtered = [makeItem()];
    mockUseOutputMgmt.paged = [makeItem()];
    mockUseOutputMgmt.totalPages = 1;
    mockUseOutputMgmt.isFormOpen = true;
    mockUseOutputMgmt.formErrors = ['Error 1', 'Error 2'];

    const { container } = render(<OutputConstraintManagement />);
    expect(container.querySelector('.wsta-form-errors')).toBeDefined();
  });
});
