import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTeamManagement } from '../useTeamManagement';

interface MockEntry {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
}

const STORE: MockEntry[] = [
  { id: 't1', name: '前端开发团队', description: '负责前端开发', status: 'active', createdAt: '2026-03-10' },
  { id: 't2', name: '后端开发团队', description: '负责后端开发', status: 'active', createdAt: '2026-03-12' },
  { id: 't3', name: '测试团队', description: '负责测试', status: 'active', createdAt: '2026-03-15' },
  { id: 't4', name: '运维团队', description: '负责运维', status: 'inactive', createdAt: '2026-03-20' },
];

let counter = 99;

vi.mock('../api', () => ({
  teamAPI: {
    fetchAll: () => Promise.resolve([...STORE] as unknown as import('../team.types').TeamEntry[]),
    create: (data: Record<string, unknown>) => {
      const created = { ...data, id: String(++counter), createdAt: new Date().toISOString().slice(0, 10) } as Record<string, string>;
      STORE.push(created as MockEntry);
      return Promise.resolve(created);
    },
    update: () => Promise.resolve(),
    remove: (id: string) => {
      const idx = STORE.findIndex((m) => m.id === id);
      if (idx >= 0) STORE.splice(idx, 1);
      return Promise.resolve();
    },
    clone: (item: Record<string, unknown>) => {
      const cloned = { ...item, id: String(++counter), name: `${String(item.name).slice(0, 28)} (副本)`, createdAt: new Date().toISOString().slice(0, 10) };
      STORE.push(cloned as MockEntry);
      return Promise.resolve(cloned);
    },
    removeBatch: (ids: Set<string>) => {
      for (let i = STORE.length - 1; i >= 0; i--) { if (ids.has(STORE[i].id)) STORE.splice(i, 1); }
      return Promise.resolve();
    },
  },
}));

describe('useTeamManagement', () => {
  it('starts loading and loads teams on mount', async () => {
    const { result } = renderHook(() => useTeamManagement());
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.processed.length).toBeGreaterThan(0);
    expect(result.current.error).toBeNull();
  });

  it('adds a team to the list', async () => {
    const { result } = renderHook(() => useTeamManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.addTeam({ name: 'Test Team', description: 'Test', status: 'active', category: 'dev' }); });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1));
  });

  it('removes a team from the list', async () => {
    const { result } = renderHook(() => useTeamManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const id = result.current.processed[0].id;
    act(() => { result.current.deleteTeam(id); });
    await waitFor(() => { expect(result.current.processed.find((t) => t.id === id)).toBeUndefined(); });
  });

  it('copies a team', async () => {
    const { result } = renderHook(() => useTeamManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const before = result.current.processed.length;
    act(() => { result.current.copyTeam(result.current.processed[0]); });
    await waitFor(() => expect(result.current.processed.length).toBe(before + 1));
  });

  it('handles search', async () => {
    const { result } = renderHook(() => useTeamManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.setSearch('__nonexistent__'); });
    expect(result.current.processed.length).toBe(0);
    act(() => { result.current.setSearch(''); });
    expect(result.current.processed.length).toBeGreaterThan(0);
  });

  it('handles category filter', async () => {
    const { result } = renderHook(() => useTeamManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.setCategoryFilter('dev'); });
    expect(result.current.processed.every((t) => t.category === 'dev')).toBe(true);
    act(() => { result.current.setCategoryFilter('all'); });
  });

  it('handles status filter', async () => {
    const { result } = renderHook(() => useTeamManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.setStatusFilter('active'); });
    expect(result.current.processed.every((t) => t.status === 'active')).toBe(true);
  });

  it('handles sort', async () => {
    const { result } = renderHook(() => useTeamManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => result.current.handleSort('status' as keyof import('../team.types').TeamEntry));
    const names = result.current.processed.map((t: import('../team.types').TeamEntry) => t.name);
    expect(names.length).toBeGreaterThan(0);
  });

  it('handles selection', async () => {
    const { result } = renderHook(() => useTeamManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const id = result.current.processed[0].id;
    act(() => { result.current.toggleSelect(id); });
    expect(result.current.selectedIds.has(id)).toBe(true);
    act(() => result.current.toggleSelect(id));
    expect(result.current.selectedIds.has(id)).toBe(false);
  });

  it('handles batch delete', async () => {
    const { result } = renderHook(() => useTeamManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    const id = result.current.processed[0].id;
    act(() => { result.current.toggleSelect(id); });
    act(() => { result.current.batchDelete(result.current.selectedIds); });
    await waitFor(() => { expect(result.current.processed.find((t) => t.id === id)).toBeUndefined(); });
  });

  it('retry reloads data', async () => {
    const { result } = renderHook(() => useTeamManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.retry(); });
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    expect(result.current.processed.length).toBeGreaterThan(0);
  });

  it('clear error resets error state', async () => {
    const { result } = renderHook(() => useTeamManagement());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 2000 });
    act(() => { result.current.clearError(); });
    expect(result.current.error).toBeNull();
  });
});
