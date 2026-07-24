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
