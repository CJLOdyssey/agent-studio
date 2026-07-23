import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSkillManagement } from '../useSkillManagement';

/** Shared mutable store so create/remove/clone reflect in fetchAll. */
const STORE = [
  { id: 's1', name: '代码审查', description: '审查代码质量', category: '开发', status: 'installed' as const, version: 'v1.0.0', author: 'admin', instructions: '审查代码', prompt_id: '', tool_names: [] as string[], output_constraint: '', createdAt: '2024-01-01' },
  { id: 's2', name: '文档生成', description: '生成文档', category: '文档', status: 'installed' as const, version: 'v1.0.0', author: 'admin', instructions: '生成文档', prompt_id: '', tool_names: [] as string[], output_constraint: '', createdAt: '2024-01-01' },
];

vi.mock('../api', () => ({
  skillAPI: {
    fetchAll: vi.fn(() => Promise.resolve([...STORE])),
    create: vi.fn((data: Record<string, unknown>) => {
      const item = { id: `new_${Date.now()}`, ...data, createdAt: '2024-01-01' } as typeof STORE[0];
      STORE.push(item);
      return Promise.resolve(item);
    }),
    update: vi.fn(async (_id: string, _data: unknown) => { /* no-op, fetchAll reflects STORE */ }),
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

describe('useSkillManagement', () => {
  it('starts loading and loads data on mount', async () => {
    const { result } = renderHook(() => useSkillManagement());
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.processed.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it('adds a skill to the list', async () => {
    const { result } = renderHook(() => useSkillManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.addSkill({ name: 'Test Skill', description: 'Test', category: '前端开发', status: 'installed', version: 'v1.0.0', author: 'me', instructions: '', prompt_id: '', tool_names: [], output_constraint: '' }); });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1));
  });

  it('removes a skill from the list', async () => {
    const { result } = renderHook(() => useSkillManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const id = result.current.processed[0].id;
    act(() => { result.current.removeSkill(id); });
    await waitFor(() => { expect(result.current.processed.find((m) => m.id === id)).toBeUndefined(); });
  });

  it('copies a skill item', async () => {
    const { result } = renderHook(() => useSkillManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.copySkill(result.current.processed[0]); });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1));
  });

  it('filters by search term', async () => {
    const { result } = renderHook(() => useSkillManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.setSearch('__nonexistent__'); });
    expect(result.current.processed.length).toBe(0);
    act(() => { result.current.setSearch(''); });
    expect(result.current.processed.length).toBe(before);
  });

  it('handles category filtering', async () => {
    const { result } = renderHook(() => useSkillManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.setCategoryFilter('nonexistent'); });
    expect(result.current.processed.length).toBe(0);
    act(() => { result.current.setCategoryFilter('all'); });
    expect(result.current.processed.length).toBeGreaterThan(0);
  });

  it('ignores sort for invalid field', async () => {
    const { result } = renderHook(() => useSkillManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.handleSort('description' as never); });
    expect(result.current.sortField).toBeNull();
  });

  it('handles sorting', async () => {
    const { result } = renderHook(() => useSkillManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.handleSort('name'); });
    const sortedAsc = result.current.processed.map((m) => m.name);
    expect([...sortedAsc]).toEqual([...sortedAsc].sort((a, b) => a.localeCompare(b, 'zh-CN')));
    // Toggle sort direction
    act(() => { result.current.handleSort('name'); });
    const sortedDesc = result.current.processed.map((m) => m.name);
    expect([...sortedDesc]).toEqual([...sortedDesc].sort((a, b) => b.localeCompare(a, 'zh-CN')));
  });

  it('handles pagination', async () => {
    const { result } = renderHook(() => useSkillManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.page).toBe(1);
    expect(result.current.totalPages).toBeGreaterThanOrEqual(1);
    if (result.current.totalPages > 1) {
      act(() => { result.current.setPage(2); });
      expect(result.current.page).toBe(2);
    }
  });

  it('handles selection', async () => {
    const { result } = renderHook(() => useSkillManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    if (result.current.processed.length < 1) return;
    const id = result.current.processed[0].id;
    act(() => { result.current.toggleSelect(id); });
    expect(result.current.selectedIds.has(id)).toBe(true);
    act(() => { result.current.toggleSelect(id); });
    expect(result.current.selectedIds.has(id)).toBe(false);
  });

  it('handles UI state toggles', async () => {
    const { result } = renderHook(() => useSkillManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.isFormOpen).toBe(false);
    act(() => { result.current.openCreate(); });
    expect(result.current.isFormOpen).toBe(true);
    expect(result.current.editingItem).toBeNull();
    act(() => { result.current.closeForm(); });
    expect(result.current.isFormOpen).toBe(false);
    if (result.current.processed.length > 0) {
      const item = result.current.processed[0];
      act(() => { result.current.openEdit(item); });
      expect(result.current.isFormOpen).toBe(true);
      expect(result.current.editingItem?.id).toBe(item.id);
      act(() => { result.current.closeForm(); });
      expect(result.current.isFormOpen).toBe(false);
    }
  });

  it('handles batch delete', async () => {
    const { result } = renderHook(() => useSkillManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.toggleSelect(result.current.processed[0].id); });
    act(() => { result.current.handleBatchDelete(); });
    await waitFor(() => expect(result.current.processed.length).toBe(before - 1));
  });
});
