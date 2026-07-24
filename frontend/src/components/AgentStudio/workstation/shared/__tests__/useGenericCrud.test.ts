import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGenericCrud } from '../useGenericCrud';
import type { GenericCrudConfig } from '../useGenericCrud.types';

interface TestItem {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface TestForm {
  name: string;
  description: string;
  category: string;
}

function makeConfig(overrides?: Partial<GenericCrudConfig<TestItem, TestForm>>): GenericCrudConfig<TestItem, TestForm> {
  return {
    api: {
      fetchAll: vi.fn<() => Promise<TestItem[]>>(),
      create: vi.fn<(data: TestForm) => Promise<TestItem>>(),
      update: vi.fn<(id: string, data: Partial<TestItem>) => Promise<void>>(),
      remove: vi.fn<(id: string) => Promise<void>>(),
      clone: vi.fn<(item: TestItem) => Promise<TestItem>>(),
      removeBatch: vi.fn<(ids: Set<string>) => Promise<void>>(),
    },
    emptyForm: { name: '', description: '', category: '' },
    itemName: 'Test',
    ...overrides,
  };
}

const sampleItems: TestItem[] = [
  { id: '1', name: 'Alpha', description: 'First item', category: 'A' },
  { id: '2', name: 'Beta', description: 'Second item', category: 'B' },
  { id: '3', name: 'Gamma', description: 'Third item', category: 'A' },
  { id: '4', name: 'Delta', description: 'Fourth item', category: 'B' },
  { id: '5', name: 'Epsilon', description: 'Fifth item', category: 'A' },
  { id: '6', name: 'Zeta', description: 'Sixth item', category: 'B' },
];

describe('useGenericCrud', { tags: ['unit'] }, () => {
  describe('initial state', () => {
    it('starts with isLoading=true before fetch resolves', () => {
      const config = makeConfig();
      config.api.fetchAll = vi.fn(() => new Promise(() => {})); // never resolves
      const { result } = renderHook(() => useGenericCrud(config));
      expect(result.current.isLoading).toBe(true);
      expect(result.current.items).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('loads items on mount and sets isLoading=false', async () => {
      const config = makeConfig();
      config.api.fetchAll = vi.fn().mockResolvedValue(sampleItems);
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.items).toEqual(sampleItems);
      expect(result.current.error).toBeNull();
    });
  });

  describe('error handling', () => {
    it('sets error when fetchAll rejects', async () => {
      const config = makeConfig();
      config.api.fetchAll = vi.fn().mockRejectedValue(new Error('Network error'));
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.error).toBe('Network error'));
      expect(result.current.isLoading).toBe(false);
    });

    it('clearError resets the error state', async () => {
      const config = makeConfig();
      config.api.fetchAll = vi.fn().mockRejectedValue(new Error('Bang'));
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.error).toBe('Bang'));
      act(() => result.current.clearError());
      expect(result.current.error).toBeNull();
    });
  });

  describe('CRUD operations', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    it('createItem calls api.create and refreshes', async () => {
      const config = makeConfig();
      const newItem: TestItem = { id: '7', name: 'New', description: '', category: 'A' };
      config.api.fetchAll = vi.fn().mockResolvedValue([]);
      config.api.create = vi.fn().mockResolvedValue(newItem);
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => { await result.current.createItem({ name: 'New', description: '', category: 'A' }); });
      expect(config.api.create).toHaveBeenCalledWith({ name: 'New', description: '', category: 'A' });
    });

    it('updateItem calls api.update and refreshes', async () => {
      const config = makeConfig();
      config.api.fetchAll = vi.fn().mockResolvedValue([sampleItems[0]]);
      config.api.update = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => { await result.current.updateItem('1', { name: 'Updated' }); });
      expect(config.api.update).toHaveBeenCalledWith('1', { name: 'Updated' });
    });

    it('removeItem calls api.remove and refreshes', async () => {
      const config = makeConfig();
      config.api.fetchAll = vi.fn().mockResolvedValue([sampleItems[0]]);
      config.api.remove = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => { await result.current.removeItem('1'); });
      expect(config.api.remove).toHaveBeenCalledWith('1');
    });

    it('cloneItem calls api.clone when available', async () => {
      const config = makeConfig();
      const original = sampleItems[0];
      const cloned = { ...original, id: '7' };
      config.api.fetchAll = vi.fn().mockResolvedValue([original]);
      config.api.clone = vi.fn().mockResolvedValue(cloned);
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await act(async () => { await result.current.cloneItem(original); });
      expect(config.api.clone).toHaveBeenCalledWith(original);
    });

    it('removeMultipleItems calls api.removeBatch', async () => {
      const config = makeConfig();
      config.api.fetchAll = vi.fn().mockResolvedValue(sampleItems);
      config.api.removeBatch = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      const ids = new Set(['1', '2']);
      await act(async () => { await result.current.removeMultipleItems(ids); });
      expect(config.api.removeBatch).toHaveBeenCalledWith(ids);
    });
  });

  describe('search filtering', () => {
    it('filters by name (case insensitive)', async () => {
      const config = makeConfig();
      config.api.fetchAll = vi.fn().mockResolvedValue(sampleItems);
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.setSearch('alpha'));
      expect(result.current.processed).toHaveLength(1);
      expect(result.current.processed[0].name).toBe('Alpha');
    });

    it('filters by description (case insensitive)', async () => {
      const config = makeConfig();
      config.api.fetchAll = vi.fn().mockResolvedValue(sampleItems);
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.setSearch('third'));
      expect(result.current.processed).toHaveLength(1);
      expect(result.current.processed[0].name).toBe('Gamma');
    });

    it('empty search returns all items', async () => {
      const config = makeConfig();
      config.api.fetchAll = vi.fn().mockResolvedValue(sampleItems);
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      // Search defaults to empty string
      expect(result.current.processed).toHaveLength(6);
    });
  });

  describe('sorting', () => {
    it('sorts ascending by name', async () => {
      const config = makeConfig({ sortFields: ['name'] });
      config.api.fetchAll = vi.fn().mockResolvedValue(sampleItems);
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.handleSort('name'));
      const names = result.current.processed.map((i) => i.name);
      expect(names).toEqual(['Alpha', 'Beta', 'Delta', 'Epsilon', 'Gamma', 'Zeta']);
    });

    it('toggles sort direction on same field', async () => {
      const config = makeConfig({ sortFields: ['name'] });
      config.api.fetchAll = vi.fn().mockResolvedValue(sampleItems);
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.handleSort('name'));  // asc
      act(() => result.current.handleSort('name'));  // desc
      const names = result.current.processed.map((i) => i.name);
      expect(names).toEqual(['Zeta', 'Gamma', 'Epsilon', 'Delta', 'Beta', 'Alpha']);
    });
  });

  describe('extra filters', () => {
    it('filters by extra filter field', async () => {
      const config = makeConfig({ extraFilters: { category: 'all' } });
      config.api.fetchAll = vi.fn().mockResolvedValue(sampleItems);
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.setExtraFilter('category', 'A'));
      expect(result.current.processed).toHaveLength(3);
      expect(result.current.processed.every((i) => i.category === 'A')).toBe(true);
    });
  });

  describe('pagination', () => {
    it('defaults to page 1 with correct total pages', async () => {
      const config = makeConfig();
      config.api.fetchAll = vi.fn().mockResolvedValue(sampleItems);
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.page).toBe(1);
      expect(result.current.totalPages).toBe(2); // 6 items / 5 per page = 2
      expect(result.current.paged).toHaveLength(5);
    });

    it('navigates to page 2', async () => {
      const config = makeConfig();
      config.api.fetchAll = vi.fn().mockResolvedValue(sampleItems);
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.setPage(2));
      await waitFor(() => expect(result.current.page).toBe(2));
      expect(result.current.paged).toHaveLength(1);
    });
  });

  describe('selection', () => {
    it('toggles single item selection', async () => {
      const config = makeConfig();
      config.api.fetchAll = vi.fn().mockResolvedValue(sampleItems);
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.toggleSelect('1'));
      expect(result.current.selectedIds.has('1')).toBe(true);
      act(() => result.current.toggleSelect('1'));
      expect(result.current.selectedIds.has('1')).toBe(false);
    });

    it('toggleSelectAll selects all items on current page', async () => {
      const config = makeConfig();
      config.api.fetchAll = vi.fn().mockResolvedValue(sampleItems);
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.toggleSelectAll());
      // Page 1 has 5 items (id: 1-5)
      expect(result.current.selectedIds.size).toBe(5);
    });

    it('toggleSelectAll deselects when all already selected', async () => {
      const config = makeConfig();
      config.api.fetchAll = vi.fn().mockResolvedValue(sampleItems);
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.toggleSelectAll()); // select
      act(() => result.current.toggleSelectAll()); // deselect
      expect(result.current.selectedIds.size).toBe(0);
    });
  });

  describe('form actions', () => {
    it('openCreate sets editingItem to null and opens form', async () => {
      const config = makeConfig();
      config.api.fetchAll = vi.fn().mockResolvedValue([]);
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.openCreate());
      expect(result.current.editingItem).toBeNull();
      expect(result.current.isFormOpen).toBe(true);
    });

    it('openEdit sets editingItem and form data', async () => {
      const config = makeConfig();
      config.api.fetchAll = vi.fn().mockResolvedValue(sampleItems);
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.openEdit(sampleItems[0]));
      expect(result.current.editingItem).toEqual(sampleItems[0]);
      expect(result.current.isFormOpen).toBe(true);
    });

    it('closeForm closes the form', async () => {
      const config = makeConfig();
      config.api.fetchAll = vi.fn().mockResolvedValue([]);
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.openCreate());
      expect(result.current.isFormOpen).toBe(true);
      act(() => result.current.closeForm());
      expect(result.current.isFormOpen).toBe(false);
    });
  });

  describe('handleSave with validation', () => {
    it('calls createItem when validation passes (no editingItem)', async () => {
      const config = makeConfig({
        validate: () => [],
      });
      config.api.fetchAll = vi.fn().mockResolvedValue([]);
      config.api.create = vi.fn().mockResolvedValue({ id: '1', name: 'X', description: '', category: '' });
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.setFormData({ name: 'X', description: '', category: '' }));
      await act(async () => { result.current.handleSave(); });
      // Should have called create (no editingItem)
      await waitFor(() => {
        expect(config.api.create).toHaveBeenCalled();
      });
    });

    it('sets formErrors when validation fails', async () => {
      const config = makeConfig({
        validate: () => ['Name is required'],
      });
      config.api.fetchAll = vi.fn().mockResolvedValue([]);
      const { result } = renderHook(() => useGenericCrud(config));
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      act(() => result.current.handleSave());
      expect(result.current.formErrors).toEqual(['Name is required']);
    });
  });
});
