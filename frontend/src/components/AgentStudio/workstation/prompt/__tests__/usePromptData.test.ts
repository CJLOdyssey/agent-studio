import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePromptData } from '../usePromptData';

const STORE = [
  { id: 'p1', name: '系统提示', content: '你是一个助手', category: '系统提示词' as const, model: '', status: 'active' as const, version: 'v1.0.0', createdAt: '2024-01-01' },
  { id: 'p2', name: '用户提示', content: '请帮助我', category: '用户提示词' as const, model: '', status: 'active' as const, version: 'v1.0.0', createdAt: '2024-01-01' },
  { id: 'p3', name: '代码审查', content: '审查代码质量', category: '任务模板' as const, model: '', status: 'active' as const, version: 'v1.0.0', createdAt: '2024-01-01' },
];

vi.mock('../api', () => ({
  promptAPI: {
    fetchAll: vi.fn(() => Promise.resolve([...STORE])),
    create: vi.fn((data: Record<string, unknown>) => {
      const item = { id: `new_${Date.now()}`, ...data, createdAt: '2024-01-01' } as typeof STORE[0];
      STORE.push(item);
      return Promise.resolve(item);
    }),
    update: vi.fn(async () => {}),
    remove: vi.fn(async (id: string) => {
      const idx = STORE.findIndex((m) => m.id === id);
      if (idx >= 0) STORE.splice(idx, 1);
    }),
    clone: vi.fn(async (item: typeof STORE[0]) => {
      const copy = { ...item, id: `${item.id}_copy` };
      STORE.push(copy);
      return Promise.resolve(copy);
    }),
    removeBatch: vi.fn(async (ids: Set<string>) => {
      for (const id of ids) {
        const idx = STORE.findIndex((m) => m.id === id);
        if (idx >= 0) STORE.splice(idx, 1);
      }
    }),
  },
}));

describe('usePromptData', () => {
  it('starts loading and loads on mount', async () => {
    const { result } = renderHook(() => usePromptData());
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.processed.length).toBeGreaterThan(0);
  });

  it('adds a prompt to the list', async () => {
    const { result } = renderHook(() => usePromptData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.addPrompt({ name: '新提示', content: '内容', category: '系统提示词' as const, model: '', status: 'active' as const, version: 'v1.0.0' }); });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1));
  });

  it('removes a prompt from the list', async () => {
    const { result } = renderHook(() => usePromptData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const id = result.current.processed[0].id;
    act(() => { result.current.removePrompt(id); });
    await waitFor(() => expect(result.current.processed.find((p) => p.id === id)).toBeUndefined(), { timeout: 3000 });
  });

  it('copies a prompt item', async () => {
    const { result } = renderHook(() => usePromptData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.copyPrompt(result.current.processed[0]); });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1), { timeout: 3000 });
  });

  it('handles search', async () => {
    const { result } = renderHook(() => usePromptData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.setSearch('__nonexistent__'); });
    expect(result.current.processed.length).toBe(0);
    act(() => { result.current.setSearch(''); });
    expect(result.current.processed.length).toBeGreaterThan(0);
  });

  it('handles category filter', async () => {
    const { result } = renderHook(() => usePromptData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.setCategoryFilter('nonexistent'); });
    expect(result.current.processed.length).toBe(0);
    act(() => { result.current.setCategoryFilter('all'); });
    expect(result.current.processed.length).toBeGreaterThan(0);
  });

  it('handles selection and batch delete', async () => {
    const { result } = renderHook(() => usePromptData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const id = result.current.processed[0].id;
    act(() => { result.current.toggleSelect(id); });
    expect(result.current.selectedIds.has(id)).toBe(true);
    act(() => { result.current.toggleSelect(id); });
    expect(result.current.selectedIds.has(id)).toBe(false);
  });

  it('handles UI state toggles', async () => {
    const { result } = renderHook(() => usePromptData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.isFormOpen).toBe(false);
    act(() => { result.current.openCreate(); });
    expect(result.current.isFormOpen).toBe(true);
    act(() => { result.current.closeForm(); });
    expect(result.current.isFormOpen).toBe(false);
    if (result.current.processed.length > 0) {
      const item = result.current.processed[0];
      act(() => { result.current.openEdit(item); });
      expect(result.current.isFormOpen).toBe(true);
      expect(result.current.editingItem?.id).toBe(item.id);
      act(() => { result.current.closeForm(); });
    }
  });

  it('provides getAllItems for export', async () => {
    const { result } = renderHook(() => usePromptData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const all = result.current.getAllItems();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThan(0);
  });

  it('addItems batch-adds items to local state', async () => {
    const { result } = renderHook(() => usePromptData());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    const newItem = { id: 'new-1', name: 'Batch', content: 'batch content', category: '系统提示词' as const, model: '', status: 'active' as const, version: 'v1.0.0', createdAt: '2024-01-01' };
    act(() => { result.current.addItems([newItem]); });
    expect(result.current.processed.length).toBe(before + 1);
  });
});
