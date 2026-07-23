import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOutputManagement } from '../useOutputManagement';

vi.mock('../api', () => ({
  outputAPI: {
    fetchAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    clone: vi.fn(),
    removeBatch: vi.fn(),
  },
}));

import { outputAPI } from '../api';

const MOCK_ITEMS = [
  { id: 'o1', name: 'JSON格式', content: '以JSON格式输出', category: '格式约束', model: '', status: 'active', version: 'v1.0.0', createdAt: '2024-01-01' },
  { id: 'o2', name: 'Markdown格式', content: '以Markdown输出', category: '格式约束', model: '', status: 'active', version: 'v1.0.0', createdAt: '2024-01-01' },
];

describe('useOutputManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (outputAPI.fetchAll as ReturnType<typeof vi.fn>).mockResolvedValue([...MOCK_ITEMS]);
    (outputAPI.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'new_1', ...MOCK_ITEMS[0] });
    (outputAPI.remove as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (outputAPI.clone as ReturnType<typeof vi.fn>).mockResolvedValue({ ...MOCK_ITEMS[0], id: 'o1_copy' });
    (outputAPI.removeBatch as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('loads data on mount', async () => {
    const { result } = renderHook(() => useOutputManagement());
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.filtered.length).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it('handles fetch error', async () => {
    (outputAPI.fetchAll as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useOutputManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.error).toBeTruthy();
  });

  it('addItem calls api.create', async () => {
    const { result } = renderHook(() => useOutputManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    await act(async () => { await result.current.addItem({ name: 'Test', content: 'Content', category: '格式约束', model: 'GPT-4o', status: 'active', version: 'v1.0.0' }); });
    expect(outputAPI.create).toHaveBeenCalled();
  });

  it('copyItem calls api.clone', async () => {
    const { result } = renderHook(() => useOutputManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.copyItem(MOCK_ITEMS[0]); });
    await waitFor(() => expect(outputAPI.clone).toHaveBeenCalledWith(MOCK_ITEMS[0]));
  });

  it('searches by name', async () => {
    const { result } = renderHook(() => useOutputManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.setSearch('JSON'); });
    await waitFor(() => expect(result.current.filtered.length).toBe(1));
    act(() => { result.current.setSearch(''); });
    await waitFor(() => expect(result.current.filtered.length).toBe(2));
  });

  it('retry reloads data', async () => {
    const { result } = renderHook(() => useOutputManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.retry(); });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
  });

  it('sets category filter', async () => {
    const { result } = renderHook(() => useOutputManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.setCategoryFilter('格式约束'); });
    expect(result.current.categoryFilter).toBe('格式约束');
    act(() => { result.current.setCategoryFilter('all'); });
    expect(result.current.categoryFilter).toBe('all');
  });

  it('toggle selection', async () => {
    const { result } = renderHook(() => useOutputManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.toggleSelect('o1'); });
    expect(result.current.selectedIds.has('o1')).toBe(true);
    act(() => { result.current.toggleSelect('o1'); });
    expect(result.current.selectedIds.has('o1')).toBe(false);
    act(() => { result.current.toggleSelectAll(); });
    expect(result.current.allOnPageSelected).toBe(true);
    act(() => { result.current.toggleSelectAll(); });
    expect(result.current.allOnPageSelected).toBe(false);
  });

  it('removeMultiple calls api.removeBatch', async () => {
    const { result } = renderHook(() => useOutputManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.removeMultiple(new Set(['o1', 'o2'])); });
    await waitFor(() => expect(outputAPI.removeBatch).toHaveBeenCalled());
  });

  it('addItems appends items', async () => {
    const { result } = renderHook(() => useOutputManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.addItems([{ id: 'new1', name: 'New', content: 'New', category: '格式约束', model: '', status: 'active', version: 'v1.0.0', createdAt: '2024-01-01' } as any]); });
    expect(result.current.filtered.length).toBe(3);
  });

  it('clearError resets error', async () => {
    const { result } = renderHook(() => useOutputManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.clearError(); });
    expect(result.current.error).toBeNull();
  });

  it('form open/close/editing', async () => {
    const { result } = renderHook(() => useOutputManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.openCreate(); });
    expect(result.current.isFormOpen).toBe(true);
    expect(result.current.editingItem).toBeNull();
    expect(result.current.editingId).toBeNull();
    act(() => { result.current.closeForm(); });
    expect(result.current.isFormOpen).toBe(false);
    act(() => { result.current.openEdit(MOCK_ITEMS[0]); });
    expect(result.current.isFormOpen).toBe(true);
    expect(result.current.editingItem).not.toBeNull();
    expect(result.current.editingId).toBe('o1');
  });

  it('handleSave validation', async () => {
    const { result } = renderHook(() => useOutputManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });

    act(() => { result.current.openCreate(); });
    act(() => { result.current.setFormData((prev) => ({ ...prev, name: 'Valid', content: 'Content' })); });
    let saved = false;
    act(() => { saved = result.current.handleSave(); });
    expect(saved).toBe(true);

    act(() => { result.current.openCreate(); });
    act(() => { result.current.setFormData((prev) => ({ ...prev, name: '', content: 'Content' })); });
    act(() => { saved = result.current.handleSave(); });
    expect(saved).toBe(false);

    act(() => { result.current.openCreate(); });
    act(() => { result.current.setFormData((prev) => ({ ...prev, name: 'Valid', content: '' })); });
    act(() => { saved = result.current.handleSave(); });
    expect(saved).toBe(false);

    act(() => { result.current.openCreate(); });
    act(() => { result.current.setFormData((prev) => ({ ...prev, name: 'X', content: 'Content' })); });
    act(() => { saved = result.current.handleSave(); });
    expect(saved).toBe(false);

    act(() => { result.current.openCreate(); });
    act(() => { result.current.setFormData((prev) => ({ ...prev, name: 'A'.repeat(51), content: 'Content' })); });
    act(() => { saved = result.current.handleSave(); });
    expect(saved).toBe(false);
  });

  it('setFormData via callback', async () => {
    const { result } = renderHook(() => useOutputManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.openCreate(); });
    act(() => { result.current.setFormData((prev) => ({ ...prev, name: 'Updated' })); });
    expect(result.current.formData.name).toBe('Updated');
  });

  it('pagination props', async () => {
    const { result } = renderHook(() => useOutputManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(typeof result.current.page).toBe('number');
    expect(typeof result.current.totalPages).toBe('number');
    act(() => { result.current.setPage(1); });
    expect(result.current.page).toBe(1);
  });

  it('menu state', async () => {
    const { result } = renderHook(() => useOutputManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.setOpenMenuId('o1'); });
    expect(result.current.openMenuId).toBe('o1');
    const el = document.createElement('div');
    act(() => { result.current.setMenuAnchorEl(el); });
    expect(result.current.menuAnchorEl).toBe(el);
  });
});
